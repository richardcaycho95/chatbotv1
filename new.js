const express= require('express');
const bodyParser = require('body-parser');

//variables constantes de ambiente
const SUSBCRIBE_MODE='subscribe';
const PAGE_ACCESS_TOKEN=process.env.PAGE_ACCESS_TOKEN;


const app = express().use(bodyParser.json());

//peticiones post del endpoint para conectar con facebook
app.post('/webhook',(req,res)=>{
    console.log('route POST: /webhook');
    const body = req.body;
    if(body.object === 'page'){
        body.entry.forEach(entry => {
            //recibimos los mensajes y los procesamos
            const webhookEvent = entry.messaging[0];
            console.log(webhookEvent);

            const sender_psid = webhookEvent.sender.id; //id de quien envia el mensaje
            console.log(`sender PSID: ${sender_psid}`);
            //validamos si recibimos mensajes
            if (webhookEvent.message) {
                handleMessage(sender_psid,webhookEvent.message);
            } else if(webhookEvent.postback) {
                handlePostback(sender_psid,webhookEvent.postback);
            }

        });
        res.status(200).send('MENSAJE RECIBIDO DESDE FACEBOOK');
    } else{
        res.sendStatus(404);
    }
});

app.get('/webhook',(req,res)=>{
    console.log('route GET: /webhook');

    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if(mode && token){
        if (mode === SUSBCRIBE_MODE && token === process.env.VERIFICATION_TOKEN) {
            console.log('WEBHOOK VERIFICADO');
            res.status(200).send(challenge);    
        } else{
            console.log(`error! mode: ${mode} and token: ${token}`);
            res.sendStatus(404);
        }
    } else{
        res.sendStatus(404);
    }
});

//sección de funciones basicas

//handles message events
function handleMessage(sender_psid,received_message){
    let response='';
    if (received_message.text) {
        response={
            'text':`Tu mensaje fue: ${received_message.text}`
        };
    }
    callSendAPI(sender_psid,response);
}
//handles messaging_postback events
function handlePostback(sender_psid,received_message){

}
//envia mensajes de respuesta a facebook mediante la "send API"
function callSendAPI(sender_psid,response){
    const requestBody = {
        'recipient':{
            'id': sender_psid
        },
        'message': response
    };

    request({
        'uri': 'https://graph.facebook.com/v6.0/me/messages',
        'qs':{
            'access_token': process.env.PAGE_ACCESS_TOKEN
        },
        'method': 'POST',
        'json': requestBody
    },(err,res,body)=>{
        if (!err) {
            console.log('Mensaje respondido con el bot');
        } else{
            console.error('No se puede responder');
        }
    })
}
//end

app.get('/',(req,res)=>{
    res.status(200).send('main page of webhook...');
});

//lanzamos el webhook
app.listen(process.env.PORT || 5000,()=>{
    console.log('servidor webhook iniciado...');
})
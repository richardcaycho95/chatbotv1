const express= require('express');
const bodyParser = require('body-parser');

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
        });
        res.status(200).send('MENSAJE RECIBIDO DESDE FACEBOOK');
    } else{
        res.sendStatus(404);
    }
});

app.get('/webhook',(req,res)=>{
    console.log('route GET: /webhook');

    const VERIFY_TOKEN='123456';
    const mode = req.query['hub.mode'];
    const token =req.query['hub.verify_token'];
    const challenge =req.query['hub.challenge'];

    if(mode && token){
        if (mode === 'suscribe' && token === VERIFY_TOKEN) {
            console.log('WEBHOOK VERIFICADO');
            res.status(200).send(challenge);    
        } else{
            res.sendStatus(404);
        }
    } else{
        res.sendStatus(404);
    }
});
app.get('/',(req,res)=>{
    res.status(200).send('main page of webhook.');
});

//lanzamos el webhook
app.listen(8080,()=>{
    console.log('servidor webhook iniciado...');
})
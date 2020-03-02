const express= require('express');
const bodyParser = require('body-parser');
const request = require('request');

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
    let responses=[];
    let response;
    if (received_message.text) {
        let data={
            'buttons':[
                {'title':'VER MENÚ DEL DIA 🍛','payload':'menu_dia'},
                {'title':'VER COMPLEMENTOS','payload':'complementos'},
                {'title':'VER POSTRES 🍰','payload':'postres'}
            ],
            'empresa':'Restaurante Sabor Peruano',
            'descripcion': 'Ahora puedes realizar tus pedidos mediante nuestro asistente virtual 🤖 de una manera facil e interactiva 😉',
            'img_url':'https://img.mesa247.pe/archivos/inversiones-sp-sabores-peruanos-eirl/sabores-peruanos-miraflores-logo.jpg'
        }
        //creando botones
        let buttons=[]
        data.buttons.forEach((button)=>{
            buttons.push({ "type":"postback", "title":button.title, "payload":button.payload })
        })
        //creando el saludo
        response={
            'text': 'Hola {{first_name}}! 😄'
        }
        responses.push(response);
        //creando bloque inicial
        response = {
            "attachment":{
                "type":"template",
                "payload":{
                    "template_type":"generic",
                    "elements":[
                        {
                            "title":data.empresa,
                            "image_url":data.img_url,
                            "subtitle":data.descripcion,
                            "buttons":buttons
                        }
                    ]
                }
              }
        }
        responses.push(response);
    }
    callSendAPI(sender_psid,responses);
}
//handles messaging_postback events
function handlePostback(sender_psid,received_postback){
    let responses = [];
    const payload=received_postback.payload;

    let data;
    let response;
    let elements;

    console.log(`payload postback ${payload}`);

    switch (payload) {
        case 'menu_dia':
            data={
                'dia': '2 DE MARZO',
                'entradas':['🍜 CALDO DE GALLINA','🐟 CEVICHE','🍣 ENSALADA DE PALTA'],
                'segundos':['✅ ESTOFADO DE POLLO CON PAPAS','✅ ARROZ CON PATO','✅ TALLARINES VERDES CON BISTECK'],
            };
            let entradas_text='';
            let segundos_text='';
            //formato de lista de entradas
            data.entradas.map((entrada)=>{
                entradas_text+=entrada+'\n';
            });
            entradas_text.replace(',','');
            //formato de lista de segundos
            data.segundos.map((segundo)=>{
                segundos_text+=segundo+'\n';
            });
            segundos_text.replace(',','');
            response={
                'text': `📌 ESTE ES EL MENÚ DEL DIA DE HOY ${data.dia} \n\nENTRADAS:\n${entradas_text}\nSEGUNDOS:\n${segundos_text}`
            };
            responses.push(response);
            break;
        case 'complementos':
            data=[
                {'descripcion':'✅ PERSONAL 410 ml','img_url':'https://www.cocacoladeperu.com.pe/content/dam/journey/pe/es/private/historias/bienstar/inca.rendition.598.336.jpg','precio':'S/. 1.50'},
                {'descripcion':'✅ GORDITA O JUMBO 625ml','img_url':'https://www.cocacoladeperu.com.pe/content/dam/journey/pe/es/private/historias/bienstar/inca.rendition.598.336.jpg','precio':'S/. 3.00'},
                {'descripcion':'✅ 1 LITRO','img_url':'https://www.cocacoladeperu.com.pe/content/dam/journey/pe/es/private/historias/bienstar/inca.rendition.598.336.jpg','precio':'S/. 5.00'},
                {'descripcion':'✅ 1 LITRO Y MEDIO','img_url':'https://www.cocacoladeperu.com.pe/content/dam/journey/pe/es/private/historias/bienstar/inca.rendition.598.336.jpg','precio':'S/. 7.00'},
            ];
            response={
                'text': `📌 ESTOS SON NUESTROS COMPLEMENTOS\n(desliza a la derecha para verlos :) )`
            };
            responses.push(response);

            elements=[];
            data.map((complemento)=>{
                let element={
                    "title":complemento.descripcion,
                    "image_url":complemento.img_url,
                    "subtitle":"Precio: "+complemento.precio
                };
                elements.push(element);
            })
            response = {
                "attachment":{
                    "type":"template",
                    "payload":{
                        "template_type":"generic",
                        "elements":elements
                    }
                  }
            }
            responses.push(response);
            break;
        case 'postres':
            data=[
                {'descripcion':'✅ FLAN','img_url':'https://dulcesperu.com/wp-content/uploads/2019/10/receta-del-flan-con-gelatina-lonchera.jpg','precio':'S/. 1.50'},
                {'descripcion':'✅ GELATINA','img_url':'https://dulcesperu.com/wp-content/uploads/2019/10/receta-del-flan-con-gelatina-lonchera.jpg','precio':'S/. 1.00'},
                {'descripcion':'✅ GELATINA CON FLAN','img_url':'https://dulcesperu.com/wp-content/uploads/2019/10/receta-del-flan-con-gelatina-lonchera.jpg','precio':'S/. 1.00'},
                {'descripcion':'✅ MARCIANOS','img_url':'https://dulcesperu.com/wp-content/uploads/2019/10/receta-del-flan-con-gelatina-lonchera.jpg','precio':'S/. 1.00'},
            ];
            response={
                'text': `📌 ESTOS SON NUESTROS POSTRES\n(desliza a la derecha para verlos :) )`
            };
            responses.push(response);

            elements=[];
            data.map((complemento)=>{
                let element={
                    "title":complemento.descripcion,
                    "image_url":complemento.img_url,
                    "subtitle":"Precio: "+complemento.precio
                };
                elements.push(element);
            })
            response = {
                "attachment":{
                    "type":"template",
                    "payload":{
                        "template_type":"generic",
                        "elements":elements
                    }
                  }
            }
            responses.push(response);
            break;
        default:
            break;
    }
    callSendAPI(sender_psid,responses);
}
//envia mensajes de respuesta a facebook mediante la "send API"
function callSendAPI(sender_psid,responses){ //response es un array con los mensajes que se enviará
    responses.forEach((response)=>{
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
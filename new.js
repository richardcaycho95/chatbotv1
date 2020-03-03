const express= require('express');
const bodyParser = require('body-parser');
const request = require('request');

//variables constantes de ambiente
const SUSBCRIBE_MODE='subscribe';
const PAGE_ACCESS_TOKEN=process.env.PAGE_ACCESS_TOKEN;

//constantes para la preferencia{menu,postre,gaseosa}
const MENU='menu';
const GASEOSA='gaseosa';
const POSTRE='postre';

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
    let responses=[];//array de respuestas a enviar
    let response; //respuesta en formato json

    if (received_message.text) {
        responses.push(getSaludo()) //creando el saludo
        responses.push(getBloqueInicial()) //creando bloque inicial
        console.log(getBloqueInicial().attachment.payload)
    }
    callSendAPI(sender_psid,responses);
}
//handles messaging_postback events
function handlePostback(sender_psid,received_postback){
    const payload=received_postback.payload;

    let responses = [];
    let response;
    let data;
    let elements;

    console.log(`payload postback ${payload}`);
    //parametros del payload
    switch (payload) {
        case 'home':
            responses.push(getBloqueInicial())
            break;
        case 'realizar_pedido':
            //primero se pregunta que entrada desea
            //responses.push(getEntradas())
            break;
        case 'menu_dia':
            //mensaje donde se detalla el menú del dia y se pregunta sobre la acción a realizar
            //se debe recorrer el bucle para leer los formatos json
            getMenuDia().map((response)=>{
                responses.push(response)
            })
            break;
        case 'complementos':
            //mensaje donde se muestra las gaseosas y se llama a la accción
            //se debe recorrer el bucle para leer los formatos json
            getComplementos().map((response)=>{
                responses.push(response)
            })
            break;
        case 'postres':
            //mensaje donde se muestra los postres y se llama a la accción
            //se debe recorrer el bucle para leer los formatos json
            getPostres().map((response)=>{
                responses.push(response)
            })
            break;
        default:
            break;
    }
    callSendAPI(sender_psid,responses);
}
//envia mensajes de respuesta a facebook mediante la "send API"
//responses:array con los mensajes que se enviará
function callSendAPI(sender_psid,responses){ 
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

function getSaludo(){
    return {'text': 'Hola {{first_name}} 😄\nDesliza para que veas nuestras opciones 👇👇👇'}
}
function getBloqueInicial(){
    //data:es un bloque,un mensaje y contiene elementos(cards)
    let data=[
        {
            'buttons':[
                {'type':'web_url','url':'https://vizarro.herokuapp.com','title':'REALIZAR PEDIDO 🛒'},
                {'type':'postback','title':'VER MENÚ DEL DIA 🍛','payload':'menu_dia'}
            ],
            'empresa':'Restaurante Sabor Peruano',
            'descripcion': 'Ahora puedes realizar tus pedidos mediante nuestro asistente virtual 🤖 😉',
            'img_url':'https://img.mesa247.pe/archivos/inversiones-sp-sabores-peruanos-eirl/sabores-peruanos-miraflores-logo.jpg'
        },
        {
            'buttons':[
                {'type':'postback','title':'VER GASEOSAS 🔰','payload':'complementos'},
                {'type':'postback','title':'VER POSTRES 🍰','payload':'postres'},   
            ],
            'empresa':'Restaurante Sabor Peruano',
            'descripcion': 'Tambien puedes pedir un postre o gaseosa o añadirla a tu pedido 😊',
            'img_url':'https://img.mesa247.pe/archivos/inversiones-sp-sabores-peruanos-eirl/sabores-peruanos-miraflores-logo.jpg'
        },
        {
            'buttons':[
                {'type':'postback','title':'UBICANOS 🗺','payload':'ubicanos'},
                {'type':'postback','title':'LLAMANOS 📞','payload':'llamanos'},   
            ],
            'empresa':'Contactanos',
            'descripcion': 'Estamos atentos 😝',
            'img_url':'https://img.mesa247.pe/archivos/inversiones-sp-sabores-peruanos-eirl/sabores-peruanos-miraflores-logo.jpg'
        }
    ]
    let elements=[];
    data.forEach((element)=>{
        //creando botones
        let buttons=getButtons(element.buttons);

        elements.push({
            "title":element.empresa,
            "image_url":element.img_url,
            "subtitle":element.descripcion,
            "buttons":buttons
        })
    })
    //elements=JSON.stringify(elements)
    return getGenericBlock(elements)
}
function getEntradas(){
    let data=[{'title':'CALDO DE GALLINA',}]
}

//return array: [0]=> response del menu,[1]=>response de los botones de accción
//se debe leer con bucle
function getMenuDia(){
    data={
        'dia': '2 DE MARZO',
        'entradas':['🍜 CALDO DE GALLINA','🐟 CEVICHE','🍣 ENSALADA DE PALTA'],
        'segundos':['✅ ESTOFADO DE POLLO CON PAPAS','✅ ARROZ CON PATO','✅ TALLARINES VERDES CON BISTECK']
    };
    let entradas_text='';
    let segundos_text='';
    //formato de lista de entradas
    data.entradas.map((entrada)=>{
        entradas_text+=entrada+'\n';
    });
    //formato de lista de segundos
    data.segundos.map((segundo)=>{
        segundos_text+=segundo+'\n';
    });
    responses.push({'text': `📌 ESTE ES EL MENÚ DEL DIA DE HOY ${data.dia} \n\nENTRADAS:\n${entradas_text}\nSEGUNDOS:\n${segundos_text}`})
    responses.push(getAccion(MENU))
    return responses;
}
function getComplementos(){
    let responses=[]
    data={
        'gaseosas':[
            {'descripcion':'✅ PERSONAL 410 ml','img_url':'https://www.cocacoladeperu.com.pe/content/dam/journey/pe/es/private/historias/bienstar/inca.rendition.598.336.jpg','precio':'S/. 1.50'},
            {'descripcion':'✅ GORDITA O JUMBO 625ml','img_url':'https://www.cocacoladeperu.com.pe/content/dam/journey/pe/es/private/historias/bienstar/inca.rendition.598.336.jpg','precio':'S/. 3.00'},
            {'descripcion':'✅ 1 LITRO','img_url':'https://www.cocacoladeperu.com.pe/content/dam/journey/pe/es/private/historias/bienstar/inca.rendition.598.336.jpg','precio':'S/. 5.00'},
            {'descripcion':'✅ 1 LITRO Y MEDIO','img_url':'https://www.cocacoladeperu.com.pe/content/dam/journey/pe/es/private/historias/bienstar/inca.rendition.598.336.jpg','precio':'S/. 7.00'}
        ],
        'mensaje_inicial':'📌 TENEMOS GASEOSAS INCA KOLA Y COCA COLA 😀\n(desliza a la derecha para verlos :) )'
    }
    responses.push({'text': data.mensaje_inicial})

    elements=[];
    data.gaseosas.map((gaseosa)=>{
        //creamos los elementos de los productos
        elements.push({
            'title':gaseosa.descripcion,
            'image_url':gaseosa.img_url,
            'subtitle':'Precio: '+gaseosa.precio
        })
    })
    //creamos el mensaje donde tendrá todos los elementos
    responses.push(getGenericBlock(elements))
    //agregamos la acción
    responses.push(getAccion(GASEOSA))
    return responses;
}
function getPostres(){
    data={
        'postres':[
            {'descripcion':'✅ FLAN','img_url':'https://dulcesperu.com/wp-content/uploads/2019/10/receta-del-flan-con-gelatina-lonchera.jpg','precio':'S/. 1.50'},
            {'descripcion':'✅ GELATINA','img_url':'https://dulcesperu.com/wp-content/uploads/2019/10/receta-del-flan-con-gelatina-lonchera.jpg','precio':'S/. 1.00'},
            {'descripcion':'✅ GELATINA CON FLAN','img_url':'https://dulcesperu.com/wp-content/uploads/2019/10/receta-del-flan-con-gelatina-lonchera.jpg','precio':'S/. 1.00'},
            {'descripcion':'✅ MARCIANOS','img_url':'https://dulcesperu.com/wp-content/uploads/2019/10/receta-del-flan-con-gelatina-lonchera.jpg','precio':'S/. 1.00'},
        ],
        'mensaje_inicial':`📌 ESTOS SON NUESTROS POSTRES\n(desliza a la derecha para verlos :) )`
    }
    elements=[]

    responses.push({'text': data.mensaje_inicial})
    data.postres.map((postre)=>{
        //elementos de los postres
        elements.push({
            "title":postre.descripcion,
            "image_url":postre.img_url,
            "subtitle":"Precio: "+postre.precio
        })
    })
    //creamos el mensaje donde tendrá todos los elementos
    responses.push(getGenericBlock(elements))
    //agregamos la acción
    responses.push(getAccion(POSTRE))
    return responses;
}
/********************************************
 * FUNCIONES BASES PARA LA CREACION DE FORMATOS JSON
 * ****************************************** */ 
function getButtons(buttons){//buttons: array que debe tener de forma obligatoria lso campos (type,title,payload)
    let temp=[];
    buttons.forEach((button)=>{
        if (button.type==='web_url') {
            format={ "type":button.type, "url":button.url,"title":button.title }
        } else{
            format={ "type":button.type, "title":button.title, "payload":button.payload }
        }
        temp.push(format)
    })
    return JSON.stringify(temp);
}
//devuelve formato json para crear mensaje de conjuntos de bloque
//elements: array donde se tiene los elementos
function getGenericBlock(elements=[]){
    return {
        "attachment":{
            "type":"template",
            "payload":{
                "template_type":"generic",
                "elements":elements
            }
        }
    }
}
//bloque que debe aparecer despues de cada consulta a menu,gaseosa o postre
//tipo:{menu,gaseosa,postre}, para enviar a la pagina web qué está pidiendo primero
function getAccion(tipo=''){
    data={
        'text':'¿Qué deseas hacer?',
        'buttons':[
            {'type':'web_url','url':`https://vizarro.herokuapp.com?preferencia=${tipo}`,'title':'REALIZAR PEDIDO 🛒'},
            {'type':'postback','title':'VOLVER AL MENÚ PRINCIPAL 🏠','payload':'home'}
        ]
    }
    return {
        'attachment':{
            "type":"template",
            "payload":{
              "template_type":"button",
              "text":data.text,
              "buttons":getButtons(data.buttons)
            }
          }
    };
}
//pagina principal
app.get('/:preferencia',(req,res)=>{
    res.status(200).send('main page of webhook...\n preferencia: '+req.params.preferencia);
});

//lanzamos el webhook
app.listen(process.env.PORT || 5000,()=>{
    console.log(`servidor webhook iniciado en el puerto ${process.env.PORT} ...`);
})
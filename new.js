const express= require('express');
const bodyParser = require('body-parser');
const request = require('request');
const path = require('path');

const admin=require('firebase-admin');

admin.initializeApp({
    credential: admin.credential.cert(__dirname+'/assets/chatbot-key.json'),
    databaseURL: "https://chatbot-delivery.firebaseio.com",
})
const db=admin.database()

const Base = require('./assets/basic_functions.js')

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
//funcion que recibe los datos del pedido
app.get('/pedidopostback',(req,res)=>{
    let responses=[]
    let body = req.query
    if(body){
        let psid=body.psid
        let comentario=body.comentario
        let pedidos=JSON.parse(body.pedido)
        let complementos=JSON.parse(body.complementos)

        responses.push({"text": `Excelente, tu texto es: ${JSON.stringify(body)}`})
        //responses.push(getQuickReply('manda tu ubicacion'))
        console.log(body)
        res.status(200).send('Please close this window to return to the conversation thread.')
        callSendAPI(psid, responses)
    }
});
////////////////////////////////////////////////////////
/*********sección de funciones basicas*****************/
////////////////////////////////////////////////////////

//handles message events
function handleMessage(sender_psid,received_message){
    let responses=[];//array de respuestas a enviar
    let response; //respuesta en formato json

    if (received_message.text) {
        getSaludo(sender_psid).then(response =>{
            console.log(response)
            responses.push(response) //creando el saludo
            responses.push(getBloqueInicial()) //creando bloque inicial
            callSendAPI(sender_psid,responses);
        })
        //console.log(getBloqueInicial().attachment.payload)
    }
}
//handles messaging_postback events
async function handlePostback(sender_psid,received_postback){
    const payload=received_postback.payload;

    let responses = [];
    let response;
    let data;
    let elements;

    console.log(`payload postback: ${payload}`);
    //parametros del payload
    switch (payload) {
        case 'home':
            responses.push(getBloqueInicial())
            break;
        case 'MENU_DIA':
            //mensaje donde se detalla el menú del dia y se pregunta sobre la acción a realizar
            //se debe recorrer el bucle para leer los formatos json
            getMenuDia().forEach((response)=>{
                responses.push(response)
            })
            break;
        case 'complementos':
            //mensaje donde se muestra las gaseosas y se llama a la accción
            //se debe recorrer el bucle para leer los formatos json
            let comple=getComplementos()
            comple.forEach((response)=>{
                responses.push(response)
            })
            console.log(comple)
            break;
        case 'postres':
            //mensaje donde se muestra los postres y se llama a la accción
            //se debe recorrer el bucle para leer los formatos json
            let postres=getPostres()
            postres.map((response)=>{
                responses.push(response)
            })
            console.log(postres)
            break;
        case 'RP_DIRECCIONES':
            let tempd= await getDireccionesByUsuario(sender_psid)
            responses.push(tempd)
            break;
        case 'GET_STARTED':
            responses.push({'text':'Bienvenido al delivery virtual :)'})
            break;
        default:
            break;
    }
    callSendAPI(sender_psid,responses)
}
//envia mensajes de respuesta a facebook mediante la "send API"
//responses:array con los mensajes que se enviará
function callSendAPI(sender_psid,responses,messaging_type='RESPONSE'){ 
    console.log('psid: '+sender_psid)
    console.log(`responses en callSendAPI: ${JSON.stringify(responses)}`)
    responses.forEach(async response=>{
        requestBody = {
            'recipient':{ 'id': sender_psid },
            'messaging_type': messaging_type,
            'message': response
        }

        await request({
            'uri': 'https://graph.facebook.com/v6.0/me/messages',
            'qs':{ 'access_token': process.env.PAGE_ACCESS_TOKEN },
            'method': 'POST',
            'json': requestBody
        },(err,res,body)=>{
            if (!err) {
                console.log(`Mensaje respondido con el bot, el response ${JSON.stringify(response)}`);
            } else{
                console.error('No se puede responder');
            }
        })
    })
}
//end

function getSaludo(sender_psid){ //retorna una promesa con el objeto que tiene el saludo con el nombre
    return new Promise((resolve,reject)=>{
        request({
            'uri':`https://graph.facebook.com/${sender_psid}?fields=first_name,last_name,profile_pic&access_token=${process.env.PAGE_ACCESS_TOKEN}`,
            'method': 'GET'
        },(err,res,body)=>{
            if (!err) {
                body=JSON.parse(body)
                console.log('Obteniendo nombre de usuario')
                console.log(body)
                resolve({'text': `Hola ${body.first_name} 😄\nDesliza para que veas nuestras opciones 👇👇👇`})
            } else{
                console.error('No se puede responder')
                reject()
            }
        })
    })
}
function getBloqueInicial(){
    //data:es un bloque,un mensaje y contiene elementos(cards)
    let data=[
        {
            'buttons':[
                // {
                //     'type':'web_url','url':'https://sabor-peruano-app.herokuapp.com',
                //     'title':'REALIZAR PEDIDO 🛒','webview_height_ratio':'tall',
                //     'messenger_extensions':'true','fallback_url':'https://sabor-peruano-app.herokuapp.com'
                // },
                {'type':'postback','title':'REALIZAR PEDIDO 🛒','payload':'RP_DIRECCIONES'},
                {'type':'postback','title':'VER MENÚ DEL DIA 🍛','payload':'MENU_DIA'}
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
                {'type':'postback','title':'NUESTRA COBERTURA 🛵','payload':'llamanos'},
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
    let responses=[]
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
    responses.push({'text': `📌 ESTE ES EL MENÚ DEL DIA DE HOY ${data.dia}😋 \n\nENTRADAS:\n${entradas_text}\nSEGUNDOS:\n${segundos_text}`})
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
    let responses=[]
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
async function getDireccionesByUsuario(psid){
    let snapshot = await db.ref('usuarios').once('value')
    console.log(`snp en main: ${JSON.stringify(snapshot)}`)
    let usuarios = Base.fillInFirebase(snapshot)
    
    let elements=[] // elementos del bloque
    let usuario_selected={existe:false,key:null}
    //buscando psid del usuario
    usuarios.map(usuario =>{
        console.log(`el usuario: ${JSON.stringify(usuario)}`)
        if(usuario.psid==psid){ //si el usuario está registrado en firebase
            usuario_selected.existe=true
            usuario_selected.key=usuario.key
            return false //termina el bucle
        }
    })
    if(usuario_selected.existe){ //si el usuario esta registrado en firebase(por su psid)
        let snapshot = await db.ref(`usuarios/${usuario_selected.key}/ubicaciones`).once('value')
        let ubicaciones = Base.fillInFirebase(snapshot)
        ubicaciones.map(ubicacion =>{
            elements.push({
                "title":ubicacion.direccion,
                "image_url":`https://maps.googleapis.com/maps/api/staticmap?center=${ubicacion.latitud},${ubicacion.longitud}&zoom=18&size=570x300&maptype=roadmap&markers=color:red%7Clabel:AQUI%7C${ubicacion.latitud},${ubicacion.longitud}&key=${Base.GMAP_API_KEY}`,
                "subtitle":"",
                "buttons":[
                    {'type':'postback','title':'SELECCIONAR','payload':'ubicanos'}
                ],
            })
        })
        elements.push(getAddLocationCard()) //card para agregar dirección del usuario
        console.log(`elements del bloque: ${JSON.stringify(elements)}`)
        let temp_responses=[]
        temp_responses.push({'text':'¿Donde te enviamos hoy tu pedido? 🛵'})
        temp_responses.push(getGenericBlock(elements))
        return temp_responses
    } else{

    }
}
/********************************************
 * FUNCIONES BASES PARA LA CREACION DE FORMATOS JSON
 * ****************************************** */ 
function getButtons(buttons){//buttons: array que debe tener de forma obligatoria lso campos (type,title,payload)
    let temp=[];
    buttons.forEach((button)=>{
        if (button.type==='web_url') {
            format={ 
                "type":button.type, "url":button.url,"title":button.title,
                "webview_height_ratio":button.webview_height_ratio,"messenger_extensions":button.messenger_extensions,
                "fallback_url":button.fallback_url
            }
        } else{
            format={ "type":button.type, "title":button.title, "payload":button.payload }
        }
        temp.push(format)
    })
    return JSON.stringify(temp);
}
function getAddLocationCard(){
    return {
        "title":'Añade una dirección',
        "image_url":`https://maps.googleapis.com/maps/api/staticmap?center=${ubicacion.latitud},${ubicacion.longitud}&zoom=18&size=570x300&maptype=roadmap&markers=color:red%7Clabel:AQUI%7C${ubicacion.latitud},${ubicacion.longitud}&key=${Base.GMAP_API_KEY}`,
        "subtitle":"",
        "buttons":[
            {'type':'postback','title':'SELECCIONAR','payload':'ubicanos'}
        ],
    }
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
app.get('/',(req,res)=>{
    res.status(200).send('main page of webhook...\n preferencia: '+req.query.preferencia);
});
app.use(express.static(__dirname + '/assets/img'));// you can access image 

//lanzamos el webhook
app.listen(process.env.PORT || 5000,()=>{
    console.log(`servidor webhook iniciado en el puerto ${process.env.PORT} ...`);
})

// app.use(function(req, res, next) {
//     res.header("Access-Control-Allow-Origin", "*"); // update to match the domain you will make the request from
//     //res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept")
//     next()
// })
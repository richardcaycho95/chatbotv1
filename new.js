const express= require('express');
const bodyParser = require('body-parser');
const request = require('request');
const path = require('path');
const rp = require('request-promise');

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
        let pedido=JSON.parse(body.pedido)
        let complementos=JSON.parse(body.complementos)
        let comentario=body.comentario
        let total = body.total
        let ubicacion_key = body.ubicacion
        
        let text = 'Tu pedido es el siguiente:\n'
        text+=getTextPedidoFromArray(pedido.entradas,'ENTRADAS')
        text+=getTextPedidoFromArray(pedido.segundos,'SEGUNDOS')
        text+=getTextPedidoFromArray(complementos.gaseosas,'GASEOSAS')
        text+=getTextPedidoFromArray(complementos.postres,'POSTRES')

        text+=`\nEnviar a: ${ubicacion_key}`
        text+=`\nTotal a pagar: ${total}`

        callSendAPI(psid,{"text": text}).then(_ =>{
            console.log(body)
            res.status(200).send('Please close this window to return to the conversation thread.')
        })
    }
});
app.get('/add_location_postback',(req,res)=>{
    let responses=[]
    let body = req.query
    if(body){
        let psid=body.psid
        saveLocation(body).then( response =>{ //devuelve el formato de respuesta para enviar al usuario
            res.status(200).send('<h1>Por favor cierra esta ventana para seguir con el pedido</h1>')
            //luego de guardar, se llama a la funcion para obtener las direcciones
            callSendAPI(psid,response).then( _ => {
                getDireccionesByUsuario(psid)
            })
        })
    } else{
        console.log('something was wrong')
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
            callSendAPI(sender_psid,response).then(r =>{ //creando el saludo
                callSendAPI(sender_psid,getBloqueInicial()) //creando bloque inicial
            })
        })
        //console.log(getBloqueInicial().attachment.payload)
    }
}
//handles messaging_postback events
async function handlePostback(sender_psid,received_postback){
    const payload=received_postback.payload;
    let data;
    let elements;

    let response = payload.split('--') //push

    console.log(`payload postback: ${payload}`);
    //parametros del payload
    switch (response[0]) {
        case 'home':
            callSendAPI(sender_psid,getBloqueInicial())
            break;
        case 'MENU_DIA':
            //mensaje donde se detalla el menú del dia y se pregunta sobre la acción a realizar
            //se debe recorrer el bucle para leer los formatos json
            callSendAPI(sender_psid,getMenuDia())
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
            getDireccionesByUsuario(sender_psid)
            break;
        case 'RP_DIR_SELECCIONADA':
            let temp_data = response[1] //id del objeto ubicacion, este ha sido seleccionado por el usuario
            direccionSeleccionada(sender_psid,temp_data)
            break;
        case 'GET_STARTED':
            callSendAPI(sender_psid,{'text':'Bienvenido al delivery virtual :)'})
            break;
        default:
            break;
    }
}
//envia mensajes de respuesta a facebook mediante la "send API"
//responses:array con los mensajes que se enviará
async function callSendAPI(sender_psid,response,messaging_type='RESPONSE'){
    console.log(`response en callSendAPI: ${JSON.stringify(response)}`)
    requestBody = {
        'recipient':{ 'id': sender_psid },
        'messaging_type': messaging_type,
        'message': response
    }
    return new Promise((resolve,reject)=>{
        request({
            'uri': 'https://graph.facebook.com/v6.0/me/messages',
            'qs':{ 'access_token': process.env.PAGE_ACCESS_TOKEN },
            'method': 'POST',
            'json': requestBody
        },(err,res,body)=>{
            if (!err) {
                console.log(`Mensaje respondido con el bot, response ${JSON.stringify(response)}`)
                resolve(response)
            } else{
                console.error('No se puede responder')
                reject(err)
            }
        })
    })
}
    // responses.forEach(async response=>{
    //     requestBody = {
    //         'recipient':{ 'id': sender_psid },
    //         'messaging_type': messaging_type,
    //         'message': response
    //     }
    //     await request({
    //         'uri': 'https://graph.facebook.com/v6.0/me/messages',
    //         'qs':{ 'access_token': process.env.PAGE_ACCESS_TOKEN },
    //         'method': 'POST',
    //         'json': requestBody
    //     },(err,res,body)=>{
    //         if (!err) {
    //             console.log(`Mensaje respondido con el bot, response ${JSON.stringify(response)}`)
    //         } else{
    //             console.error('No se puede responder')
    //         }
    //     })
    // })
//end
function getTextPedidoFromArray(data,title=''){
    let temp_text =''
    if(data.length > 0) { temp_text+=`\n:${title}:\n` }
    data.map( element =>{
        temp_text+=`✅ ${element.text} (${element.cantidad}) \n`
    })
    return temp_text
}
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
async function saveLocation(body){
    let snapshot = await db.ref('usuarios').once('value')
    let usuarios = Base.fillInFirebase(snapshot)

    let usuario_selected={existe:false,key:null}
    //buscando psid del usuario
    usuarios.map(usuario =>{
        if(usuario.psid==body.psid){ //si el usuario está registrado en firebase
            usuario_selected.existe=true
            usuario_selected.key=usuario.key
            return false //termina el bucle
        }
    })
    //objeto de ubicacion
    let temp_data={
        direccion: body.direccion,
        latitud: body.latitud,
        longitud: body.longitud,
        referencia: body.referencia
    }
    return new Promise((resolve,reject)=>{
        if(usuario_selected.existe){ //si el usuario esta registrado en firebase(por su psid)
            db.ref(`usuarios/${usuario_selected.key}/ubicaciones`).push(temp_data)
        } else{ //si el usuario no está registrado, se procede a registrar
            let new_usuario={
                psid: body.psid,
                telefono:'',
                ubicaciones:{
                    "ubicacion_1": temp_data
                }
            }
            db.ref('usuarios').push(new_usuario)
        }
        resolve({'text':'Genial! Haz agregado correctamente tu ubicación'})
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
    // responses.push({'text': `📌 ESTE ES EL MENÚ DEL DIA DE HOY ${data.dia}😋 \n\nENTRADAS:\n${entradas_text}\nSEGUNDOS:\n${segundos_text}`})
    // //responses.push(getAccion(MENU))
    // return responses;
    return {'text': `📌 ESTE ES EL MENÚ DEL DIA DE HOY ${data.dia}😋 \n\nENTRADAS:\n${entradas_text}\nSEGUNDOS:\n${segundos_text}`}
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
    let usuarios = Base.fillInFirebase(snapshot)
    
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
    let add_location = getAddLocationCard(psid) //card para agregar dirección del usuario
    let elements=[] // elementos del bloque
    if(usuario_selected.existe){ //si el usuario esta registrado en firebase(por su psid)
        let snapshot = await db.ref(`usuarios/${usuario_selected.key}/ubicaciones`).once('value')
        let ubicaciones = Base.fillInFirebase(snapshot)
        ubicaciones.map(ubicacion =>{
            elements.push({
                "title":ubicacion.referencia,
                "subtitle":ubicacion.referencia,
                "image_url":`https://maps.googleapis.com/maps/api/staticmap?center=${ubicacion.latitud},${ubicacion.longitud}&zoom=18&size=570x300&maptype=roadmap&markers=color:red%7Clabel:AQUI%7C${ubicacion.latitud},${ubicacion.longitud}&key=${Base.GMAP_API_KEY}`,
                "buttons":[
                    {'type':'postback','title':'SELECCIONAR','payload':`RP_DIR_SELECCIONADA--${ubicacion.key}`}
                ]
            })
        })
        elements.push(add_location)
        //console.log(`elements del bloque: ${JSON.stringify(elements)}`)
        text={'text':'¿A donde enviamos hoy tu pedido? 🛵'}
        callSendAPI(psid,text).then( response =>{
            callSendAPI(psid,getGenericBlock(elements)).then( _ =>{})
        })
    } else{
        elements.push(add_location)
        text={'text':'No tienes guardada ninguna dirección, agrega una para poder continuar con el pedido'}
        callSendAPI(psid,text).then( _ =>{
            callSendAPI(psid,getGenericBlock(elements))
        })
    }
}
async function direccionSeleccionada(psid,ubicacion_key){
    data={
        'text':'Genial, para seguir con el pedido presiona CONTINUAR ✅',
        'buttons':[
            {
                'type':'web_url','url':`${Base.WEB_URL}?ubicacion=${ubicacion_key}`,
                'title':'CONTINUAR ✅','webview_height_ratio':'tall',
                'messenger_extensions':'true','fallback_url':`${Base.WEB_URL}?ubicacion=${ubicacion_key}`
            },
            {'type':'postback','title':'CAMBIAR DIRECCION','payload':'home'}
        ]
    }
    callSendAPI(psid,getTemplateButton(data))
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
function getAddLocationCard(psid){
    return {
        "title":'Añade una ubicación',
        "image_url":`${Base.WEBHOOK_URL}/add_location.jpg`,
        "subtitle":"",
        "buttons":[
            {
                'type':'web_url','webview_height_ratio':'tall',
                'url':`${Base.WEB_URL}/add_location`,
                'title':'AGREGAR','messenger_extensions':'true',
                'url':`${Base.WEB_URL}/add_location`
            }
        ]
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
    return getTemplateButton(data)
}
function getTemplateButton(data){ //debe tener los atributos[text(string),buttons(array)]
    return {
        'attachment':{
            "type":"template",
            "payload":{
              "template_type":"button",
              "text":data.text,
              "buttons":getButtons(data.buttons)
            }
          }
    }
}
//pagina principal
app.get('/',(req,res)=>{
    res.status(200).send('main page of webhook...\n');
});
app.use(express.static(`${__dirname}/assets/img`));// you can access image 

//lanzamos el webhook
app.listen(process.env.PORT || 5000,()=>{
    console.log(`servidor webhook iniciado en el puerto ${process.env.PORT} ...`);
})

// app.use(function(req, res, next) {
//     res.header("Access-Control-Allow-Origin", "*"); // update to match the domain you will make the request from
//     //res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept")
//     next()
// })
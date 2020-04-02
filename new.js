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
const BaseJson = require('./assets/basic_json_functions')
const BasePayload = require('./assets/basic_payload_functions')

const app = express().use(bodyParser.json());

app.use(express.static(`${__dirname}/assets/img`));// mostrar imagenes de assets

//lanzamos el webhook
app.listen(process.env.PORT || 5000,()=>{
    console.log(`servidor webhook iniciado en el puerto ${process.env.PORT} ...`);
})

/******************************************************/
/********************ROUTES****************************/
/******************************************************/
//pagina principal
app.get('/',(req,res)=>{
    res.status(200).send('main page of webhook...\n');
});
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
        if (mode === Base.SUSBCRIBE_MODE && token === Base.VERIFICATION_TOKEN) {
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
        let ubicacion = JSON.parse(body.ubicacion) //ahora se recibe el objeto que es un string
        
        let text = 'Tu pedido es el siguiente:\n'
        text+=Base.getTextPedidoFromArray(pedido.entradas,'ENTRADAS')
        text+=Base.getTextPedidoFromArray(pedido.segundos,'SEGUNDOS')
        text+=Base.getTextPedidoFromArray(complementos.gaseosas,'GASEOSAS')
        text+=Base.getTextPedidoFromArray(complementos.postres,'POSTRES')

        text+=(comentario=='')?'':`\nComentario: ${comentario}`
        text+=`\nEnviar a: ${ubicacion.referencia}`
        text+=`\nTotal a pagar: ${total}`

        res.status(200).send('<center><h1>Cierra esta ventana para poder seguir con el pedido :)</h1></center>')
        
        typing(psid,4000).then( __ =>{
            callSendAPI(psid,{"text": text}).then(_ =>{
                templateAfterPedido(psid,body)
            })
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
/**************************************************************/
/********FUNCIONES BASICAS PARA COMUNICAR CON EL BOT***********/
/**************************************************************/
//handle quick replies
function handleQuickReply(sender_psid,message){
    const payload=message.quick_reply.payload;

    let response = payload.split('--')
    let temp_data = (response.length>1)?response[1]:[]

    switch (response[0]) {
        case 'RP_TELEFONO_QR': //se recibe el numero seleccionado por QR
            let numero = message.text
            savePhoneNumber(sender_psid,numero,temp_data).then(data => {

            })
            break;
        default:
            break;
    }
}
//handles message events
function handleMessage(sender_psid,received_message){ //received_message: body.entry[n].messaging[n].message
    let responses=[];//array de respuestas a enviar
    let response; //respuesta en formato json
    if(received_message.quick_reply){ //si el mensaje posee un QR
        handleQuickReply(sender_psid,received_message)
    } else if (received_message.text) { //si no hay QR
        getSaludo(sender_psid).then(response =>{
            callSendAPI(sender_psid,response).then(r =>{ //creando el saludo
                callSendAPI(sender_psid,getBloqueInicial()) //creando bloque inicial
            })
        })
    }
}
//handles messaging_postback events
async function handlePostback(sender_psid,received_postback){
    const payload=received_postback.payload;

    let response = payload.split('--')
    let temp_data = (response.length>1)?response[1]:[]

    console.log(`payload postback: ${payload}`);
    //parametros del payload
    switch (response[0]) {
        case 'home':
            callSendAPI(sender_psid,getBloqueInicial())
            break;
        case 'MENU_DIA':
            //mensaje donde se detalla el menú del dia y se pregunta sobre la acción a realizar
            //se debe recorrer el bucle para leer los formatos json
            callSendAPI(sender_psid,BasePayload.getMenuDia())
            break;
        case 'complementos':
            //mensaje donde se muestra las gaseosas y se llama a la accción
            //se debe recorrer el bucle para leer los formatos json
            let comple=BasePayload.getComplementos()
            comple.forEach((response)=>{
                responses.push(response)
            })
            console.log(comple)
            break;
        case 'postres':
            //mensaje donde se muestra los postres y se llama a la accción
            //se debe recorrer el bucle para leer los formatos json
            let postres=BasePayload.getPostres()
            postres.map((response)=>{
                responses.push(response)
            })
            console.log(postres)
            break;
        case 'RP_DIRECCIONES':
            getDireccionesByUsuario(sender_psid)
            break;
        case 'RP_DIR_SELECCIONADA':
            direccionSeleccionada(sender_psid,temp_data)//temp_data: objeto ubicacion codificado, este ha sido seleccionado por el usuario
            break;
        case 'RP_PEDIR_TELEFONO':
            pedirTelefono(sender_psid,temp_data) //la data viene codificada desde /pedidopostback (body) y este pasa por templateAfterPedido para al final llegar a esta
            break;
        case 'RP_AGREGAR_TELEFONO':
            telefonoQR(sender_psid,temp_data)
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
            'qs':{ 'access_token': Base.PAGE_ACCESS_TOKEN },
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
/*****END:FUNCIONES BASICAS PARA COMUNICAR CON EL BOT:END********/
/**
 * activa la acción "typing" y lo desactiva de acuerdo a los milisegundos asignado
 * @param {*} psid id del usuario a enviar
 * @param {*} time milisegundos activo la acción
 */
async function typing(psid,time){
    let requestBody = {
        "recipient":psid,
        "sender_action":"typing_on"
    }
    await request({
        'uri':`https://graph.facebook.com/v2.6/me/messages`,
        'qs':{ 'access_token': Base.PAGE_ACCESS_TOKEN },
        'method': 'POST',
        'json': requestBody

    },(err,res,body)=>{})
    return new Promise((resolve,reject)=>{
        setTimeout(() => {
            requestBody.sender_action='typing_off'
            request({
                'uri':`https://graph.facebook.com/v2.6/me/messages`,
                'qs':{ 'access_token': Base.PAGE_ACCESS_TOKEN },
                'method': 'POST',
                'json': requestBody
            },(err,res,body)=>{
                resolve()
            })
        }, time);
    })
    
}

function getSaludo(sender_psid){ //retorna una promesa con el objeto que tiene el saludo con el nombre
    return new Promise((resolve,reject)=>{
        request({
            'uri':`https://graph.facebook.com/${sender_psid}?fields=first_name,last_name,profile_pic&access_token=${Base.PAGE_ACCESS_TOKEN}`,
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
async function templateAfterPedido(psid,body){ //envia la data de body (string)
    let data_encoded = Base.encodeData(body)

    let data={
        'text':'Si tu pedido está conforme, presiona CONTINUAR ✅, sino presiona MODIFICAR PEDIDO',
        'buttons':[
            {'type':'postback','title':'CONTINUAR ✅','payload':`RP_PEDIR_TELEFONO--${data_encoded}`},
            {'type':'postback','title':'MODIFICAR PEDIDO','payload':`MODIFICAR_PEDIDO--${data_encoded}`}
        ]
    }
    callSendAPI(psid,BaseJson.getTemplateButton(data))
}
async function telefonoQR(psid,body_encoded){
    data = {
        "text": "Digita tu número (o seleccionalo si es el que te mostramos 👇):",
        "quick_replies":[
            { "content_type":"user_phone_number", "payload":`RP_TELEFONO_QR--${body_encoded}` }
        ]
    }
    callSendAPI(psid,data)
}
async function pedirTelefono(psid,body_encoded){ //muestra los telefonos registrados(si hubiera) y muestra card de agregar telefono
    let data_decoded = Base.decodeData(body_encoded)
    let usuario_selected = await getUsuarioByPsid(psid)
    let add_phone = getAddPhoneCard(body_encoded)
    // let telefono = {
    //     numero: body.numero
    // }
    let elements = []
    if (usuario_selected.existe) { //si esta registrado en firebase por su psid, se procede a comprobar si tiene telefonos registrados
        let snapshot = await db.ref(`usuarios/${usuario_selected.key}/telefonos`).once('value')
        telefonos = Base.fillInFirebase(snapshot)
        if(telefonos.length>0){ //tiene telenos registrados
            telefonos.map(telefono =>{
                data_decoded.telefono = {key: telefono.key,numero:telefono.numero}
                let data_encoded = Base.encodeData(data_decoded)
                //el payload viene arrastrando la data del pedido, ubicacion y ahora se añade el telefono seleccionado
                elements.push({
                    "text":'',
                    "buttons":[
                        {'type':'postback','title':'SELECCIONAR','payload':`RP_TELEFONO_SELECCIONADO--${data_encoded}`}
                    ]
                })
            })
            elements.push(add_phone)
            text={'text':'Escoge o agrega un número de celular 📲:'}
            callSendAPI(psid,text).then( response =>{
                callSendAPI(psid,BaseJson.getGenericBlock(elements)).then( _ =>{})
            })
        } else{ //no tiene telefonos registrados
            elements.push(add_phone)
            text={'text':'📌 Agrega un número de celular para avisarte sobre el estado de tu pedido:'}
            callSendAPI(psid,text).then( response =>{
                callSendAPI(psid,BaseJson.getGenericBlock(elements)).then( _ =>{})
            })
        }
    }
}
async function getUsuarioByPsid(psid){ //retorna un objeto con los atributos "existe" cuyo valor boleano de acuerdo a si encuentra al usuario o no, "key": de existir, este atributo tiene la key del usuario
    let snapshot = await db.ref('usuarios').once('value')
    let usuarios = Base.fillInFirebase(snapshot)

    let usuario_selected={existe:false,key:null}
    //buscando psid del usuario
    usuarios.map(usuario =>{
        if(usuario.psid==psid){ //si el usuario está registrado en firebase
            usuario_selected.existe=true
            usuario_selected.key=usuario.key
            return false //termina el bucle
        }
    })
    return usuario_selected
}
async function saveLocation(body){
    let usuario_selected=await getUsuarioByPsid(body.psid)
    //objeto de ubicacion
    let ubicacion={
        direccion: body.direccion,
        latitud: body.latitud,
        longitud: body.longitud,
        referencia: body.referencia
    }
    return new Promise((resolve,reject)=>{
        if(usuario_selected.existe){ //si el usuario esta registrado en firebase(por su psid)
            db.ref(`usuarios/${usuario_selected.key}/ubicaciones`).push(ubicacion)
        } else{ //si el usuario no está registrado, se procede a registrar
            saveUser(psid,'ubicaciones',ubicacion)
        }
        resolve({'text':'Genial! Haz agregado correctamente tu ubicación'})
    })
}
async function saveUser(psid,atributo,data){
    let new_usuario={
        psid: psid,
        telefonos:'',
        ubicaciones: ''
    }
    if (atributo=='ubicaciones') {
        new_usuario.ubicaciones= { "ubicacion_1": data }
    } else if (atributo=='telefonos') {
        new_usuario.ubicaciones= { "telefono_1": data }
    }
    db.ref('usuarios').push(new_usuario)
}
async function savePhoneNumber(psid,number,data){ //guarda el numero de celular del usuario; data:dat codificada que viene del hilo
    let usuario_selected=await getUsuarioByPsid(body.psid)
    let telefono={ numero:number }
    return new Promise((resolve,reject)=>{
        let data_decoded = Base.decodeData(data)
        if(usuario_selected.existe){ //si el usuario esta registrado en firebase(por su psid)
            let new_telefono = db.ref(`usuarios/${usuario_selected.key}/telefonos`).push(telefono)
            data_decoded.telefono = {key:new_telefono.key,text:number}
        } else{ //si el usuario no está registrado, se procede a registrar
            saveUser(psid,'telefonos',telefono)
        }
        let data_encoded = Base.encodeData(data_decoded)
        resolve(data_encoded)
    })
}
function getBloqueInicial(){
    //data:es un bloque,un mensaje y contiene elementos(cards)
    let data=[
        {
            'buttons':[
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
        let buttons=BaseJson.getButtons(element.buttons);

        elements.push({
            "title":element.empresa,
            "image_url":element.img_url,
            "subtitle":element.descripcion,
            "buttons":buttons
        })
    })
    //elements=JSON.stringify(elements)
    return BaseJson.getGenericBlock(elements)
}
async function getDireccionesByUsuario(psid){
    let usuario_selected = await getUsuarioByPsid(psid)
    let add_location = getAddLocationCard() //card para agregar dirección del usuario
    let elements=[] // elementos del bloque
    if(usuario_selected.existe){ //si el usuario esta registrado en firebase(por su psid)
        let snapshot = await db.ref(`usuarios/${usuario_selected.key}/ubicaciones`).once('value')
        let ubicaciones = Base.fillInFirebase(snapshot)
        ubicaciones.map(ubicacion =>{
            let ubicacion_encoded = Base.encodeData(ubicacion) //aca inicia la codificacion de datos del pedido
            elements.push({
                "title":ubicacion.referencia,
                "subtitle":ubicacion.referencia,
                "image_url":`https://maps.googleapis.com/maps/api/staticmap?center=${ubicacion.latitud},${ubicacion.longitud}&zoom=18&size=570x300&maptype=roadmap&markers=color:red%7Clabel:AQUI%7C${ubicacion.latitud},${ubicacion.longitud}&key=${Base.GMAP_API_KEY}`,
                "buttons":[
                    {'type':'postback','title':'SELECCIONAR','payload':`RP_DIR_SELECCIONADA--${ubicacion_encoded}`}
                ]
            })
        })
        elements.push(add_location)
        //console.log(`elements del bloque: ${JSON.stringify(elements)}`)
        text={'text':'¿A donde enviamos hoy tu pedido? 🛵'}
        callSendAPI(psid,text).then( response =>{
            callSendAPI(psid,BaseJson.getGenericBlock(elements)).then( _ =>{})
        })
    } else{
        elements.push(add_location)
        text={'text':'No tienes guardada ninguna dirección, agrega una para poder continuar con el pedido'}
        callSendAPI(psid,text).then( _ =>{
            callSendAPI(psid,BaseJson.getGenericBlock(elements))
        })
    }
}
async function direccionSeleccionada(psid,ubicacion_encoded){ //se recoge el objeto ubicacion y se manda a la web
    let ubicacion_decoded = Base.decodeData(ubicacion_encoded)
    let str_ubicacion = JSON.stringify(ubicacion_decoded)
    let data={
        'text':'Genial, para seguir con el pedido presiona CONTINUAR ✅',
        'buttons':[
            {
                'type':'web_url','url':`${Base.WEB_URL}?ubicacion=${str_ubicacion}`,
                'title':'CONTINUAR ✅','webview_height_ratio':'tall',
                'messenger_extensions':'true','fallback_url':`${Base.WEB_URL}?ubicacion=${str_ubicacion}`
            },
            {'type':'postback','title':'CAMBIAR DIRECCION','payload':'RP_DIRECCIONES'}
        ]
    }
    callSendAPI(psid,BaseJson.getTemplateButton(data))
}
/********************************************
 * FUNCIONES BASES PARA LA CREACION DE FORMATOS JSON
 * ****************************************** */ 
function getAddLocationCard(){
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
function getAddPhoneCard(data_encoded){
    return {
        "title":'Añade un número de celular 📲:',
        "image_url":`${Base.WEBHOOK_URL}/add_location.jpg`,
        "subtitle":"",
        "buttons":[
            {'type':'postback','title':'AGREGAR','payload':`RP_AGREGAR_TELEFONO--${data_encoded}`},
        ]
    }
}

// app.use(function(req, res, next) {
//     res.header("Access-Control-Allow-Origin", "*"); // update to match the domain you will make the request from
//     //res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept")
//     next()
// })
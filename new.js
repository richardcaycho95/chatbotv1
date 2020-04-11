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
    let pre_pedido = getPrePedidoByPsid(body.psid)
    if(pre_pedido!=''){// si aun está disponible el pre_pedido
        if(body){
            let ubicacion_data = JSON.parse(body.ubicacion)
            let data = {
                psid: body.psid,
                pedido: JSON.parse(body.pedido),
                complementos: JSON.parse(body.complementos),
                comentario: body.comentario,
                total: body.total,
                ubicacion: {
                    referencia:ubicacion_data.referencia,
                    direccion: ubicacion_data.direccion,
                    latitud: ubicacion_data.latitud,
                    longitud: ubicacion_data.longitud
                },
                flujo:body.flujo,
                created_at:Base.getDate(),
                usuario_key:ubicacion_data.usuario_key
            }

            typing(data.psid,5000).then( __ =>{
                let text = 'Tu pedido es el siguiente:\n'
                text+=Base.getTextPedidoFromArray(data.pedido.entradas,'ENTRADAS')
                text+=Base.getTextPedidoFromArray(data.pedido.segundos,'SEGUNDOS')
                text+=Base.getTextPedidoFromArray(data.complementos.gaseosas,'GASEOSAS')
                text+=Base.getTextPedidoFromArray(data.complementos.postres,'POSTRES')

                text+=(data.comentario=='')?'':`\nComentario: ${data.comentario}`
                text+=`\nTotal a pagar: ${data.total}`

                callSendAPI(data.psid,{"text": text}).then(_ =>{
                    templateAfterPedido(data.psid,data)
                })
            })
            res.sendFile(`${__dirname}/pages/index.html`)
        }
    } else{
        callSendAPI(body.psid,{text:'Lo sentimos, ha pasado mucho tiempo desde que empezaste con tu pedido, por favor, escribenos para iniciar nuevamente'})
    }
});
app.get('/add_location_postback',(req,res)=>{
    let responses=[]
    let body = req.query
    if(body.psid!=''){
        let psid=body.psid
        saveLocation(body).then( response =>{ //devuelve el formato de respuesta para enviar al usuario
            //luego de guardar, se llama a la funcion para obtener las direcciones
            callSendAPI(psid,response).then( _ => {
                templateDirecciones(psid)
                res.sendFile(`${__dirname}/pages/index.html`)
            })
        })
    } else{
        console.log('psid no definido en add_location_postback')
    }
});
app.post('/save_pedido',(req,res)=>{
    //let body = JSON.parse(req.query)
    res.json({id_pedido:'123'})
})
/**************************************************************/
/********FUNCIONES BASICAS PARA COMUNICAR CON EL BOT***********/
/**************************************************************/
//handle quick replies
async function handleQuickReply(sender_psid,message){
    const payload = message.quick_reply.payload
    let data_encoded = await getPrePedidoByPsid(sender_psid)
    let response = payload.split('--')
    let phone = {initial: payload.substr(0,3), size: payload.length }

    if (phone.initial =='+51' && phone.size == 12) { //si el texto tiene indicios de ser el celular
        if (data_encoded!='') { //si la data aun no se ha eliminado
            savePhoneNumber(sender_psid,payload,data_encoded).then(response => {
                pedirTelefono(sender_psid,response)
            })
        }
    }
    //cuando el usuario elige una sugerencia de horario de envio
    if(response[0]=='HORA_ENVIO'){
        if (data_encoded!='') { //si la data aun no se ha eliminado
            saveHorarioEnvio(sender_psid,response[1],data_encoded).then(response => {
                sendDetailPrePedido(sender_psid,response)
            })
        }
    }
}
/**
 * handles message events
 * @param {Number} sender_psid id del usuario 
 * @param {*} received_message body.entry[n].messaging[n].message
 */
async function handleMessage(sender_psid,received_message){
    let usuario = await getUsuarioByPsid(sender_psid)
    if(!usuario.existe){ await saveUser(sender_psid,'','')}

    if(received_message.quick_reply){ //si el mensaje posee un QR
        handleQuickReply(sender_psid,received_message)
    } else if (received_message.text) { //si no hay QR
        let data = await getPrePedidoByPsid(sender_psid)
        console.log(data)
        if(data.pedido_asignado){ //si hay pedidos confirmados
            if(data.multiple_pedido==true){ //si se aceptó tener multiples pedidos
                data = data.pre_pedido
            } else{
                sendAskMultiplePedido(sender_psid)
                return false
            }
        }
        if (data=='' || data===undefined) { //si no hay prepedido
            sendSaludo(sender_psid).then(_ =>{
                callSendAPI(sender_psid,getBloqueInicial()) //creando bloque inicial
            })
        } else{ //si el usuario tiene un pre pedido pendiente
            let data_decoded = Base.decodeData(data)
            if(data_decoded.flujo==Base.FLUJO.PEDIR_HORARIO_ENVIO){ //el flujo está pidiendo el horario de envio y el usuario lo ha escrito
                saveHorarioEnvio(sender_psid,received_message.text,data).then(response =>{
                    sendDetailPrePedido(sender_psid,response)
                })
            } else{
                managePrePedido(sender_psid,data)
            }
        }
    }
}
//handles messaging_postback events
async function handlePostback(sender_psid,received_postback){
    const payload=received_postback.payload;

    let response = payload.split('--')
    let temp_data = (response.length>1)?response[1]:''

    if(response[0]=='CONFIRM_MULTIPLE_PEDIDO'){ //si el usuario confirma que desea pedir nuevamente
        confirmMultiplePedido(sender_psid)
    }
    let pre_pedido = await getPrePedidoByPsid(sender_psid)

    if(pre_pedido.pedido_asignado){ //si hay pedidos confirmados
        if(pre_pedido.multiple_pedido==true){ //si se aceptó tener multiples pedidos
            pre_pedido = pre_pedido.pre_pedido
        } else{
            sendAskMultiplePedido(sender_psid)
            return false
        }
    }

    console.log(`payload postback: ${payload}`)
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
            //mensaje donde se muestra los postres y se llama a la acción
            //se debe recorrer el bucle para leer los formatos json
            let postres=BasePayload.getPostres()
            postres.map((response)=>{
                responses.push(response)
            })
            console.log(postres)
            break;
        case 'RP_DIRECCIONES': //cuando el usuario selecciona el botón "REALIZAR PEDIDO"
            if (pre_pedido!='') { //si hay un pre_pedido
                managePrePedido(sender_psid,pre_pedido)
            } else{ //si no hay pre_pedido
                templateDirecciones(sender_psid)
            }
            break;
        case 'RP_CAMBIAR_DIRECCION': //cuando el usuario desea cambiar  su dirección
            if (pre_pedido!='') { //si hay un pre_pedido (ya hay una dirección almacenada)
                deletePrePedido(sender_psid,true)
            }
            templateDirecciones(sender_psid)
            break;
        case 'RP_DIR_SELECCIONADA': //cuando el usuario selecciona una dirección mostrada, aca recien se empezará a crear el pre_pedido
            if (pre_pedido!='') { //si hay un pre_pedido, mandar al flujo
                managePrePedido(sender_psid,pre_pedido)
            } else{ //si no hay pre_pedido
                direccionSeleccionada(sender_psid,response[1])//response[1]: objeto ubicacion codificado, este ha sido seleccionado por el usuario
            }
            break;
        case 'RP_PEDIR_TELEFONO'://cuando el usuario confirma que su pedido es conforme y presiona "CONTINUAR"
            if (pre_pedido!='') {
                pedirTelefono(sender_psid,pre_pedido) //la data viene codificada desde /pedidopostback (data) y este pasa por templateAfterPedido para al final llegar a esta
            } else{
                managePrePedido(sender_psid,pre_pedido)
            }
            break;
        case 'RP_AGREGAR_TELEFONO':
            telefonoQR(sender_psid,temp_data)
            break;
        case 'RP_TELEFONO_SELECCIONADO': //cuando se ha seleccionado un telefono, se procede a pedir el horario de envio 
            //el usuario selecciona un número de las cards que se muestra, cada card tiene codificada la data anterior y el numero respectivo, cuando se selecciona se trae en la segunda parte del payload, y luego se guarda en firebase
            if (pre_pedido!='') {
                templatePedirHorarioEnvio(sender_psid,response[1])
            } else{
                managePrePedido(sender_psid,pre_pedido)
            }
            break;
        case 'CONFIRMAR_PEDIDO':
            if(pre_pedido!=''){ //si hay pre_pedido
                savePedido(sender_psid,pre_pedido).then(id_pedido =>{
                    callSendAPI(sender_psid,{text:`Tu orden N° ${id_pedido} ha sido generada 😎👍.\nMuchas gracias por utilizar el servicio 😊.`})
                })
            } else{
                managePrePedido(sender_psid,pre_pedido)
            }
            break;
        case 'CANCELAR_PREPEDIDO':
            if(pre_pedido!=''){ // si hay pre_pedido
                deletePrePedido(sender_psid,true).then(_ =>{
                    callSendAPI(sender_psid,{text:`${Base.NOMBRE_BOT} está listo para recibir tus ordenes, solo escibenos cuando desees 😊`})
                })
            } else{ //si el pre_pedido ya ha sido eliminado y el usuario siue presionando el mismo botón
                callSendAPI(sender_psid,{text:'Ya se eliminó tu pedido... No olvides que nuestro chatbot está listo para recibir tus ordenes 😊'})
            }
            break;
        case 'SEGUIR_PREPEDIDO':
            callSendAPI(sender_psid,{text:'Continuemos 😎 ...'}).then( _ =>{
                managePrePedido(sender_psid,pre_pedido)
            })
            break;
        case 'GET_STARTED':
            templateGetStarted(sender_psid)
            break;
        default:
            break;
    }
}
/**
 * envia mensajes de respuesta a facebook mediante la "send API" 
 * @param {Number} sender_psid id del usuario
 * @param {JSON} response mensajes que se enviará, estructura json
 * @param {String} messaging_type tipo de mensaje
 */
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
 * @param {Number} psid id del usuario a enviar
 * @param {Number} time milisegundos que estará activa la acción
 */
async function typing(psid,time){
    let requestBody = {
        "recipient":{ "id":psid },
        "sender_action":"typing_on"
    }
    request({
        'uri':`https://graph.facebook.com/v2.6/me/messages`,
        'qs':{ 'access_token': Base.PAGE_ACCESS_TOKEN },
        'method': 'POST',
        'json': requestBody

    },(err,res,body)=>{ console.log(body)})
    return new Promise((resolve,reject)=>{
        setTimeout(() => {
            requestBody.sender_action='typing_off'
            request({
                'uri':`https://graph.facebook.com/v2.6/me/messages`,
                'qs':{ 'access_token': Base.PAGE_ACCESS_TOKEN },
                'method': 'POST',
                'json': requestBody
            },(err,res,body)=>{
                console.log(body)
                resolve()
            })
        }, time);
    })
}
/**
 * retorna una promesa con el objeto que tiene el saludo con el nombre
 * @param {Number} sender_psid id del usuario
 */
async function sendSaludo(psid){
    return new Promise((resolve,reject) =>{
        getProfileFromFacebook(psid).then(response =>{
            callSendAPI(psid,{text:`Hola ${response.first_name} 😊\nDesliza para que veas nuestras opciones 👇👇👇`})
        })
        resolve()
    })
}
/**
 * envia el detalle del pedido que se está armando
 * @param {*} psid id del usuario
 * @param {*} data_encoded data codificada, debe ser la mas actualizada de firebase
 */
async function sendDetailPrePedido(psid,data_encoded){
    let data = Base.decodeData(data_encoded)
    let temp_text=`Te resumimos tu pedido:\n`
    temp_text+=Base.getTextPedidoFromArray(data.pedido.entradas,'ENTRADAS')
    temp_text+=Base.getTextPedidoFromArray(data.pedido.segundos,'SEGUNDOS')
    temp_text+=Base.getTextPedidoFromArray(data.complementos.gaseosas,'GASEOSAS')
    temp_text+=Base.getTextPedidoFromArray(data.complementos.postres,'POSTRES')
    temp_text+=(data.comentario=='')?'':`\nComentario: ${data.comentario}`
    temp_text+=`\nEnviar a: ${data.ubicacion.referencia} (${data.ubicacion.referencia})` //change
    temp_text+=`\nHora de entrega: ${data.horario_envio}`
    temp_text+=`\nTeléfono: ${data.telefono.numero}`
    temp_text+=`\nTotal a pagar: ${data.total}`

    callSendAPI(psid,{text: temp_text}).then(_ =>{
        let response = {
            text: 'Si todo está conforme, selecciona CONFIRMAR PEDIDO ✅',
            buttons:[
                BaseJson.getPostbackButton('CONFIRMAR PEDIDO ✅','CONFIRMAR_PEDIDO')
            ]
        }
        callSendAPI(psid,BaseJson.getTemplateButton(response))
    })
}
async function sendAskMultiplePedido(psid){
    let id_pedido = '123'
    let data = {
        text:`La orden N° ${id_pedido} está en proceso...\n¿Deseas agregar otro pedido?`,
        buttons:[
            BaseJson.getPostbackButton('SI','CONFIRM_MULTIPLE_PEDIDO'),
            BaseJson.getPostbackButton('NO','DENEGAR_MULTIPLE_PEDIDO')
        ]
    }
    callSendAPI(psid,BaseJson.getTemplateButton(data))
}
/**
 * retorna la información publica del usuario que se tiene en facebook (first_name,last_name,etc) en formato json
 * @param {*} psid id del usuario
 */
async function getProfileFromFacebook(psid){
    return new Promise((resolve,reject)=>{
        request({
            'uri':`https://graph.facebook.com/${psid}?fields=first_name,last_name,profile_pic&access_token=${Base.PAGE_ACCESS_TOKEN}`,
            'method': 'GET'
        },(err,res,body)=>{
            if (!err) {
                resolve(JSON.parse(body))
            } else{
                console.error('No se puede responder')
                reject(err)
            }
        })
    })
}
/**
 * envia la data del body que se obtiene en la ruta 'pedidopostback', se guarda el pre_pedido
 * @param {Number} psid id del usuario
 * @param {Object} data_decoded data del formulario que tiene el pedido, la ubicación seleccionada, el flujo
 */
async function templateAfterPedido(psid,data_decoded){ 
    let data_encoded = Base.encodeData(data_decoded)
    savePrePedido(psid,data_encoded).then(_ =>{
        let data={
            'text':'Si tu pedido está conforme, presiona CONTINUAR ✅, sino presiona MODIFICAR PEDIDO ✏',
            'buttons':[
                BaseJson.getPostbackButton('CONTINUAR ✅','RP_PEDIR_TELEFONO'),
                BaseJson.getPostbackButton('MODIFICAR PEDIDO ✏','MODIFICAR_PEDIDO')
            ]
        }
        callSendAPI(psid,BaseJson.getTemplateButton(data))
    })
}
async function telefonoQR(psid){
    data = {
        "text": "Escribe tu número (o seleccionalo si es el que te mostramos 👇):",
        "quick_replies":[{ "content_type":"user_phone_number"}]
    }
    callSendAPI(psid,data)
}
/**
 * muestra los telefonos registrados(si hubiera) y muestra card de agregar telefono
 * @param {Number} psid id del usuario
 * @param {String} body_encoded data codificada que se viene transformando por el flujo
 */
async function pedirTelefono(psid,data_encoded){
    let data_decoded = Base.decodeData(data_encoded)
    let usuario_selected = await getUsuarioByPsid(psid)
    let elements = []

    data_decoded.flujo = Base.FLUJO.PEDIR_TELEFONO
    savePrePedido(psid,Base.encodeData(data_decoded))

    if (usuario_selected.existe) { //si esta registrado en firebase por su psid, se procede a comprobar si tiene telefonos registrados
        let snapshot = await db.ref(`usuarios/${usuario_selected.key}/telefonos`).once('value')
        telefonos = Base.fillInFirebase(snapshot)
        if(telefonos.length>0){ //tiene telenos registrados
            telefonos.map(telefono =>{
                data_decoded.telefono = {key: telefono.key,numero:telefono.numero}
                let data_encoded = Base.encodeData(data_decoded)
                //el payload viene arrastrando la data del pedido, ubicacion y ahora se añade el telefono seleccionado
                elements.push({
                    "title":telefono.numero,
                    "subtitle":"",
                    "buttons":[
                        BaseJson.getPostbackButton('SELECCIONAR',`RP_TELEFONO_SELECCIONADO--${data_encoded}`)
                    ]
                })
            })
            elements.push(getAddPhoneCard(data_encoded))
            text={'text':'Escoge o agrega un número de celular 📲:'}
            callSendAPI(psid,text).then( _ =>{
                callSendAPI(psid,BaseJson.getGenericBlock(elements))
            })
        } else{ //no tiene telefonos registrados
            elements.push(getAddPhoneCard(data_encoded,true))
            text={'text':'📌 Agrega un número de celular para avisarte sobre el estado de tu pedido:'}
            callSendAPI(psid,text).then( response =>{
                callSendAPI(psid,BaseJson.getGenericBlock(elements)).then( _ =>{})
            })
        }
    }
}
/**
 * devuelve el objeto usuario(en caso exista) y se agrega el atributo 'existe' = true, si no existe se devuelve solo el atributo 'existe' =false
 * @param {*} psid id del usuario de messenger
 */
async function getUsuarioByPsid(psid){
    let snapshot = await db.ref('usuarios').once('value')
    let usuarios = Base.fillInFirebase(snapshot)

    let usuario_selected = {existe:false,key:null}
    //buscando psid del usuario
    usuarios.map(usuario =>{
        if(usuario.psid==psid){ //si el usuario está registrado en firebase
            usuario_selected.existe = true
            usuario_selected.key = usuario.key
            usuario_selected.pre_pedido = usuario.pre_pedido
            usuario_selected.created_at = usuario.created_at
            usuario_selected.pedidos = usuario.pedidos
            usuario_selected.multiple_pedido = usuario.multiple_pedido
            return false //termina el bucle
        }
    })
    return usuario_selected
}
async function saveLocation(body){
    console.log(`psid en savelocation: ${body.psid}`)
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
            saveUser(body.psid,'ubicaciones',ubicacion) 
        }
        resolve({'text':'Genial! Haz agregado correctamente tu ubicación 😎'})
    })
}
/**
 * guarda un objeto usuario en firebase
 * @param {*} psid id del usuario
 * @param {*} atributo atributo que se asignará la data
 * @param {*} data data que se asignará segun el atributo
 */
async function saveUser(psid,atributo,data){
    let new_usuario={
        psid: psid,
        telefonos:'',
        ubicaciones: '',
        created_at:'',
        pre_pedido: '',
        pedidos:'',
        multiple_pedido: false
    }
    if(psid!=''){
        if (atributo=='ubicaciones') {
            new_usuario.ubicaciones= { "ubicacion_1": data }
        } else if (atributo=='telefonos') {
            new_usuario.telefonos= { "telefono_1": data }
        }
        //verificar si el usuario ya está registrado, si es asi, se actualiza
        let usuario = await getUsuarioByPsid(psid)
        if (usuario.existe) {
            db.ref(`usuarios/${usuario.key}/${atributo}`).push(data)
        } else{
            db.ref('usuarios').push(new_usuario)
        }
    } else{
        console.log('se esta queriendo guardar a un usuario con psid vacio')
    }
}
/**
 * guarda el numero de celular del usuario y devuelve la data codificada agregando atributo 'telefono'
 * @param {*} psid id del usuario
 * @param {*} number payload, numero del usuario mediante QR
 * @param {*} data_encoded data codificada que se trae desde firebase
 */
async function savePhoneNumber(psid,number,data_encoded){
    let usuario_selected=await getUsuarioByPsid(psid)
    let telefono={ numero:number }
    let data_decoded = Base.decodeData(data_encoded)
    return new Promise((resolve,reject)=>{
        if(usuario_selected.existe){ //si el usuario esta registrado en firebase(por su psid)
            let new_telefono = db.ref(`usuarios/${usuario_selected.key}/telefonos`).push(telefono)
            data_decoded.telefono = {key:new_telefono.key,text:number}
        } else{ //si el usuario no está registrado, se procede a registrar
            saveUser(psid,'telefonos',telefono)
        }
        resolve(Base.encodeData(data_decoded))
    })
}
/**
 * guarda horario de envio que elegió el usuario y devuelve la data codificada agregando atributo 'horario_envio'
 * @param {*} psid id del usuario
 * @param {*} horario horario que el usuario eligió (mediante QR) o escribió
 * @param {*} data_encoded este campo debe tener la data extraida desde firebase
 */
async function saveHorarioEnvio(psid,horario,data_encoded){
    let data_decoded = Base.decodeData(data_encoded)
    return new Promise((resolve,reject)=>{
        data_decoded.horario_envio = horario
        data_decoded.flujo=Base.FLUJO.HORARIO_ENVIO_GUARDADO
        savePrePedido(psid,Base.encodeData(data_decoded)).then(_ =>{
            resolve(Base.encodeData(data_decoded))
        })
    })
}
/**
 * guarda el pedido confirmado por el usuario y retorna el id del pedido generado en el backend
 * @param {*} psid id del usuario
 * @param {*} data_encoded data codificada, debe ser la mas actualizada desde firebase
 */
async function savePedido(psid,data_encoded){
    let data_decoded = Base.decodeData(data_encoded)
    data_decoded.flujo=Base.FLUJO.PEDIDO_CONFIRMADO
    return new Promise((resolve,reject)=>{
        request({
            'uri': `${Base.WEBHOOK_URL}/save_pedido`,
            'qs':{ 'access_token': Base.WEB_ACCESS_TOKEN },
            'method': 'POST',
            'json': data_decoded
        },(err,res,body)=>{
            if (!err) {
                deletePrePedido(psid,true).then(_ =>{
                    db.ref(`usuarios/${data_decoded.usuario_key}/pedidos`).push({id:body.id_pedido})
                    resolve(body.id_pedido)
                })
            } else{
                console.error('No se puede responder')
                reject(err)
            }
        })
    })
}
function getBloqueInicial(){
    //data:es un bloque,un mensaje y contiene elementos(cards)
    let data=[
        {
            'buttons':[
                BaseJson.getPostbackButton('REALIZAR PEDIDO 🛒','RP_DIRECCIONES'),
                BaseJson.getPostbackButton('VER MENÚ DEL DIA 🍛','MENU_DIA')
            ],
            'empresa':Base.NOMBRE_EMPRESA,
            'descripcion': 'Ahora puedes realizar tus pedidos mediante nuestro asistente virtual 🤖 😉',
            'img_url':'https://img.mesa247.pe/archivos/inversiones-sp-sabores-peruanos-eirl/sabores-peruanos-miraflores-logo.jpg'
        },
        {
            'buttons':[
                BaseJson.getPostbackButton('VER GASEOSAS 🔰','VER_GASEOSAS'),
                BaseJson.getPostbackButton('VER POSTRES 🍰','VER_POSTRES')
            ],
            'empresa':Base.NOMBRE_EMPRESA,
            'descripcion': 'Tambien puedes pedir un postre o gaseosa o añadirla a tu pedido 😊',
            'img_url':'https://img.mesa247.pe/archivos/inversiones-sp-sabores-peruanos-eirl/sabores-peruanos-miraflores-logo.jpg'
        },
        {
            'buttons':[
                BaseJson.getPostbackButton('UBICANOS 🗺','UBICANOS'),
                BaseJson.getPostbackButton('LLAMANOS 📞','LLAMANOS'),
                BaseJson.getPostbackButton('NUESTRA COBERTURA 🛵','NUESTRA_COBERTURA')
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
    return BaseJson.getGenericBlock(elements)
}
/**
 * gestiona el pre_pedido, si el usuario selecciona un proceso anterior o no sigue el flujo de la conversacion, esta función permite seguir con el proceso
 * @param {*} psid id del usuario
 * @param {*} pre_pedido data codificada que ha sido traida desde firebase
 */
async function managePrePedido(psid,pre_pedido){
    let data_decoded = Base.decodeData(pre_pedido)
    let flujo = Base.FLUJO
    typing(psid,2100).then(_ => {
        callSendAPI(psid,{text:'Debes seguir el flujo de la conversación para tomar tu pedido correctamente... Te guiaremos donde te quedaste:'}).then(__ =>{
            switch (data_decoded.flujo) {
                case flujo.PEDIR_DIRECCION:
                    templateDirecciones(psid)
                    break;
                case flujo.DIRECCION_SELECCIONADA:
                    direccionSeleccionada(psid,pre_pedido)
                    break;
                case flujo.POST_PEDIDO:
                    //despues que se llena el pedido desde le formulario
                    templateAfterPedido(psid,data_decoded)
                    break;
                case flujo.PEDIR_TELEFONO:
                    pedirTelefono(psid,pre_pedido)
                    break;
                case flujo.TELEFONO_SELECCIONADO:
                    
                    break;
                case flujo.HORARIO_ENVIO_GUARDADO:
                    sendDetailPrePedido(psid,pre_pedido)
                    break;
                default:
                    break;
            }
        })
    })
}
/**
 * Actualiza la información en firebase del pre_pedido
 * @param {*} psid id del usuario
 * @param {*} data_encoded data codificada a guardar
 */
async function savePrePedido(psid,data_encoded){
    let usuario = await getUsuarioByPsid(psid)
    if (usuario.existe) {
        let today = Base.getDate()
        return new Promise((resolve,reject) =>{
            db.ref(`usuarios/${usuario.key}`).update({
                'created_at':today,
                'pre_pedido':data_encoded
            })
            resolve()
        })
    }
}
/**
 * setea los atributos 'created_at' y 'pre_pedido' a vacio
 * @param {String} key key del objeto usuario seleccionado
 * @param {Boolean} is_psid si es verdadero, la key es el psid, si el primer parametro es la key del usuario, omitir
 */
async function deletePrePedido(key,is_psid=false){
    let my_key = key
    if(is_psid) {
        let temp = await getUsuarioByPsid(key)
        my_key = temp.key
    }
    db.ref(`usuarios/${my_key}`).update({
        'created_at':'',
        'pre_pedido':'',
        'multiple_pedido':false
    })
}
/**
 * devuelve la data codificada (si hubiera) del usuario identificado por psid, sino devuelve string vacio... Si hay pedidos confirmados devuelve un objeto {pedido_asignado:true,multiple_pedido:Boolean}
 * @param {number} psid  id del usuario
 */
async function getPrePedidoByPsid(psid){
    let usuario = await getUsuarioByPsid(psid)

    if(usuario.pedidos==''){ //si no hay pedidos confirmados
        if (usuario.existe && usuario.pre_pedido!='') { //si el usuario existe y tiene pre_pedido
            let diff = Math.abs(new Date(Base.getDate())-new Date(usuario.created_at)) //actual - create_at = diff in ms
            let minutes = Math.floor((diff/1000)/60)
            console.log(`dif: ${diff} minutos: ${minutes}`)
    
            if (minutes>=30) { //si el pre_pedido pasa los 30 minutos, se elimina
                await deletePrePedido(usuario.key)
                return '' //no hay data del pre_pedido
            } else{
                return usuario.pre_pedido
            }
        } else{  //devuelve vacio
            return usuario.pre_pedido
        }
    } else{ //si ya se tiene pedidos confirmados
        let temp_pre_pedido
        let diff = Math.abs(new Date(Base.getDate())-new Date(usuario.created_at))
        let minutes = Math.floor((diff/1000)/60)

        if (minutes>=30) { //si el pre_pedido pasa los 30 minutos, se elimina
            await deletePrePedido(usuario.key)
            temp_pre_pedido = ''
        } else{
            temp_pre_pedido = usuario.pre_pedido
        }
        return {pedido_asignado:true,multiple_pedido:usuario.multiple_pedido,pre_pedido:temp_pre_pedido}
    }
}
/**
 * 
 * @param {Number} psid id del usuario
 */
async function templateDirecciones(psid){
    let usuario_selected = await getUsuarioByPsid(psid)
    let add_location = getAddLocationCard(psid) //card para agregar dirección del usuario
    let elements=[] // elementos del bloque
    if(usuario_selected.existe){ //si el usuario esta registrado en firebase(por su psid)
        let snapshot = await db.ref(`usuarios/${usuario_selected.key}/ubicaciones`).orderByKey().once('value')
        let ubicaciones = Base.fillInFirebase(snapshot)
        ubicaciones.map(ubicacion =>{
            ubicacion.flujo = Base.FLUJO.PEDIR_DIRECCION
            ubicacion.usuario_key = usuario_selected.key
            ubicacion.created_at = Base.getDate()
            let ubicacion_encoded = Base.encodeData(ubicacion) //aca inicia la codificacion de datos del pedido
            elements.push({
                "title":ubicacion.referencia, //change
                "subtitle":ubicacion.referencia,
                "image_url":`https://maps.googleapis.com/maps/api/staticmap?center=${ubicacion.latitud},${ubicacion.longitud}&zoom=18&size=570x300&maptype=roadmap&markers=color:red%7Clabel:AQUI%7C${ubicacion.latitud},${ubicacion.longitud}&key=${Base.GMAP_API_KEY}`,
                "buttons":[
                    BaseJson.getPostbackButton('SELECCIONAR',`RP_DIR_SELECCIONADA--${ubicacion_encoded}`)
                ]
            })
        })
        elements.push(add_location)
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
/**
 * template que se muestra cuando el usuario presiona el botón EMPEZAR
 * @param {Number} psid id del usuario
 */
async function templateGetStarted(psid){
    let response = await getProfileFromFacebook(psid)
    await callSendAPI(psid,{text:`Hola ${response.first_name}, te presentamos a ${Base.NOMBRE_BOT}, nuestro asistente virtual 🤖, que es parte de una nueva experiencia de delivery que el *${Base.NOMBRE_EMPRESA}* pone a tu disposición 🤗. \n\nEn unos simples pasos podrás realizar tu pedido desde la comodidad de tu hogar o desde donde te encuentres, ${Base.NOMBRE_BOT} te hará unas sencillas preguntas para concretar tu pedido.\n\nA continuación te enseñamos como funciona ${Base.NOMBRE_BOT} 🤖`})

    typing(psid,4000).then(_ =>{
        callSendAPI(psid,BaseJson.getImage(Base.IMG_INSTRUCCIONES))
    })
}
async function templatePedirHorarioEnvio(psid,data_encoded){
    let data_decoded = Base.decodeData(data_encoded)
    data_decoded.flujo = Base.FLUJO.PEDIR_HORARIO_ENVIO
    savePrePedido(psid,Base.encodeData(data_decoded))

    let data_qr = {
        text:`Empezamos a repartir desde las ${Base.REPARTO.HORA_INICIO} hasta las ${Base.REPARTO.HORA_FIN}\nEscribe a que hora deseas que te enviemos tu pedido:\n(Acá te dejamos algunas sugerencias 👇)`,
        quick_replies:Base.getSugerenciaHorariosEnvio()
    }
    callSendAPI(psid,data_qr)
}
/**
 * se recoge el objeto ubicacion y se manda a la web
 * @param {*} psid id del usuario
 * @param {*} ubicacion_encoded data pre_pedido codificada
 */
async function direccionSeleccionada(psid,ubicacion_encoded){
    let ubicacion_decoded = Base.decodeData(ubicacion_encoded)
    ubicacion_decoded.flujo = Base.FLUJO.DIRECCION_SELECCIONADA
    ubicacion_decoded.created_at = Base.getDate()
    let url = `${Base.WEB_URL}?ubicacion=${JSON.stringify(ubicacion_decoded)}&psid=${psid}`
    let data={
 
        'text':`Haz elegido *${ubicacion_decoded.referencia}* como dirección de envío 📌\n\nPara elegir tu menú, selecciona VER MENÚ 🍛 (y espera unos segundos que se abra la ventana)\n\nSi deseas cambiar la dirección, selecciona CAMBIAR DIRECCIÓN 🔄`,
        'buttons':[
            {
                'type':'web_url','url':url,
                'title':'VER MENÚ 🍛','webview_height_ratio':'tall',
                'messenger_extensions':'true','fallback_url':url
            },
            BaseJson.getPostbackButton('CAMBIAR DIRECCIÓN 🔄','RP_CAMBIAR_DIRECCION')
        ]
    }

    let data_encoded = Base.encodeData(ubicacion_decoded)
    savePrePedido(psid,data_encoded).then(_ =>{
        callSendAPI(psid,BaseJson.getTemplateButton(data))
    })
}
/**
 * confirma que el usuario desea realizar multiples pedidos, setea 'multiple_pedido'=true
 * @param {*} psid id del usuario
 */
async function confirmMultiplePedido(psid){
    let usuario = await getUsuarioByPsid(psid)
    if(usuario.existe){
        deletePrePedido(usuario.key).then(_ =>{
            db.ref(`usuarios/${usuario.key}`).update({
                multiple_pedido:true
            })
        })
    }
}
/********************************************
 * FUNCIONES BASES PARA LA CREACION DE FORMATOS JSON
 * ****************************************** */ 
function getAddLocationCard(psid){
    let url = `${Base.WEB_URL}/add_location?psid=${psid}`
    return {
        "title":'Agrega una ubicación',
        "image_url":`${Base.WEBHOOK_URL}/add_location.jpg`,
        "subtitle":"",
        "buttons":[
            {
                'type':'web_url','webview_height_ratio':'tall',
                'url':url,
                'title':'AGREGAR','messenger_extensions':'true',
                'url':url
            }
        ]
    }
}
/**
 * devuelve formato json de un card que agrega un numero e implementarlo en un template
 * @param {*} data_encoded data codificada que se concatenará en el payload
 * @param {*} is_first_time si es verdadero, se muestra un detalle para guiar al usuario
 */
function getAddPhoneCard(data_encoded,is_first_time=false){
    return {
        "title":'Agrega un número de celular 📲',
        "subtitle":(is_first_time)?'La primera vez que pidas tendrás que agregar un número de celular para podernos contactarte, en los proximos pedidos ya lo tendremos listo para seleccionarlo':'',
        "buttons":[
            BaseJson.getPostbackButton('AGREGAR',`RP_AGREGAR_TELEFONO--${data_encoded}`)
        ]
    }
}
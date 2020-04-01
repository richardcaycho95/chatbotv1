//MODULO QUE TIENE TODAS LAS FUNCIONES QUE RETORNAN LOS DIFERENTES FORMATOS JSON QUE SE NECESITA PARA CREAR UNA RESPUESTA Y MANDAR AL API DE MESSENGER
var self = module.exports = {
    getButtons:function(buttons){//buttons: array que debe tener de forma obligatoria lso campos (type,title,payload)
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
    },
    //devuelve formato json para crear mensaje de conjuntos de bloque
    //elements: array donde se tiene los elementos
    getGenericBlock:function(elements=[]){
        return {
            "attachment":{
                "type":"template",
                "payload":{
                    "template_type":"generic",
                    "elements":elements
                }
            }
        }
    },
    getTemplateButton:function(data){ //debe tener los atributos[text(string),buttons(array)]
        return {
            'attachment':{
                "type":"template",
                "payload":{
                "template_type":"button",
                "text":data.text,
                "buttons":self.getButtons(data.buttons)
                }
            }
        }
    },
    getAccion:function(tipo=''){
        data={
            'text':'¿Qué deseas hacer?',
            'buttons':[
                {'type':'web_url','url':`https://vizarro.herokuapp.com?preferencia=${tipo}`,'title':'REALIZAR PEDIDO 🛒'},
                {'type':'postback','title':'VOLVER AL MENÚ PRINCIPAL 🏠','payload':'home'}
            ]
        }
        return self.getTemplateButton(data)
    },
}
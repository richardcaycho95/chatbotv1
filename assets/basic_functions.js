var self = module.exports = {
  /**
   * devuelve la información que tiene snapshot en formato json y se agrega el atributo key
   * @param {*} snapshot objeto que genera firebase el cual se tiene la data
   */
  fillInFirebase: function(snapshot){
    console.log(`snapshot: ${JSON.stringify(snapshot.val())}`)
    let temp_return=[]
    snapshot.forEach(element => {
      let item = element.val()
      item.key=element.key
      temp_return.push(item)
    })
    return temp_return
  },
  /**
   * el texto ya tiene un formato definido
   * @param {*} data información que se trae desde pedidopostback
   * @param {*} title titulo del mensaje
   */
  getTextPedidoFromArray:function(data,title=''){
      let temp_text =''
      if(data.length > 0) { temp_text+=`\n${title}:\n` }
      data.map( element =>{
          temp_text+=`✅ ${element.text} (${element.cantidad}) \n`
      })
      return temp_text
  },
  /**
   * decodificada la data en base64 y la devuelve en formato json
   * @param {String} encoded data codificada
   */
  decodeData:function(encoded){
      let buff = Buffer.from(encoded,'base64')
      return JSON.parse(buff.toString('ascii'))
  },
  /**
   * codificada la data a base64 y devuelve una cadena
   * @param {JSON} decoded data codificada
   */
  encodeData:function(decoded){
      let buff = Buffer.from(JSON.stringify(decoded))
      return buff.toString('base64')
  },
  getDate:function(date='',only_hour=false){
    let today
    if(date==''){
      today = new Date()
      today.setHours(today.getHours()-5)
    } else today = date

    let dd = String(today.getDate()).padStart(2, '0');
    let mm = String(today.getMonth() + 1).padStart(2, '0')
    let yyyy = today.getFullYear()
    let h = String(today.getHours()).padStart(2,'0')
    let m = String(today.getMinutes()).padStart(2,'0')
    let i = String(today.getSeconds()).padStart(2,'0')

    if(only_hour){ //si solo se necesita la hora
      return `${h}:${m}:${i}`
    } else{
      return `${yyyy}-${mm}-${dd} ${h}:${m}:${i}`
    }
  },
  getSugerenciaHorariosEnvio: function(){
    let generic_payload = 'HORA_ENVIO'
    let data = ['LO MAS ANTES POSIBLE','12:00 PM','1:00 PM','2:00 PM']
    let hours_qr = []
    data.forEach(value =>{
      hours_qr.push({content_type:'text', title:value, payload:`${generic_payload}--${value}`})
    })
    return hours_qr
  },
  /**
   * retorna la información publica del usuario que se tiene en facebook (first_name,last_name,etc) en formato json
   * @param {*} psid id del usuario
   */
  getProfileFromFacebook:async function(psid){
    return new Promise((resolve,reject)=>{
        request({
            'uri':`https://graph.facebook.com/${psid}?fields=first_name,last_name,profile_pic&access_token=${self.PAGE_ACCESS_TOKEN}`,
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
  },
  GMAP_API_KEY: 'AIzaSyDxIn9qXbWD1lvSzHCiphSNw7_jiPK6obw',
  WEBHOOK_URL: 'https://vizarro.herokuapp.com',
  FALLBACK_URL: 'https://restaurante-saborperuano.netlify.com/fallback',
  WEB_URL: 'https://restaurante-saborperuano.netlify.com',
  //constantes para la preferencia{menu,postre,gaseosa}
  MENU:'menu',
  GASEOSA:'gaseosa',
  POSTRE:'postre',
  //variables constantes de ambiente
  SUSBCRIBE_MODE:'subscribe',
  PAGE_ACCESS_TOKEN:process.env.PAGE_ACCESS_TOKEN,
  WEB_ACCESS_TOKEN:process.env.WEB_ACCESS_TOKEN,//'abc123456'
  VERIFICATION_TOKEN:process.env.VERIFICATION_TOKEN,
  FLUJO:{
      PEDIR_DIRECCION:'templateDirecciones',
      DIRECCION_SELECCIONADA:'direccion_seleccionada',
      POST_PEDIDO:'post_pedido',
      PEDIR_TELEFONO:'pedir_telefono',
      TELEFONO_SELECCIONADO:'telefono_seleccionado',
      PEDIR_HORARIO_ENVIO:'pedir_horario_envio',
      HORARIO_ENVIO_GUARDADO:'horario_envio_guardado',
      PEDIDO_CONFIRMADO:'pedido_confirmado'
  },
  NOMBRE_BOT:'HERBIE',
  IMG_INSTRUCCIONES:`https://restaurante-saborperuano.netlify.com/instrucciones.jpg`,
  REPARTO:{
    HORA_INICIO:'11:00 AM',
    HORA_FIN:'3:00 PM'
  },
  PEDIDO_ASIGNADO:'pedido_asignado',
  NOMBRE_EMPRESA:'Restaurante Sabor Peruano'
}
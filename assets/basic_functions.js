var self = module.exports = {
  fillInFirebase: function(snapshot){
    console.log(`snapshot: ${JSON.stringify(snapshot.val())}`)
    let temp_return=[]
    snapshot.forEach(element => {
      let item = element.val()
      item.key=element.key
      temp_return.push(item)
    })
    console.log(JSON.stringify(temp_return))
    //return Object.values(snapshot.val())
    // let temp=snapshot.val()
    // let temp_return=[]
    // for (const prop in temp) {
    //   if (temp.hasOwnProperty(prop)) {
    //     temp_return.push(temp[prop])
    //   }
    // }
    // //temp_return['key']=snapshot.key
    // console.log(`snapshot en array: ${JSON.stringify(temp_return)}`)
    return temp_return
  },
  getTextPedidoFromArray:function(data,title=''){ //el texto ya tiene un formato definido
      let temp_text =''
      if(data.length > 0) { temp_text+=`\n${title}:\n` }
      data.map( element =>{
          temp_text+=`✅ ${element.text} (${element.cantidad}) \n`
      })
      return temp_text
  },
  decodeData:function(encoded){
      let buff = Buffer.from(encoded,'base64')
      return JSON.parse(buff.toString('ascii'))
  },
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
    let hours_qr = [
      {content_type:'text',title:'LO MAS ANTES POSIBLE',payload:'HORA_ENVIO--AHORA'},
      {content_type:'text',title:'12:00 PM',payload:'HORA_ENVIO--12PM'},
      {content_type:'text',title:'1:00 PM',payload:'HORA_ENVIO--1PM'},
      {content_type:'text',title:'2:00 PM',payload:'HORA_ENVIO--2PM'}
    ]
    return hours_qr
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
  VERIFICATION_TOKEN:process.env.VERIFICATION_TOKEN,
  FLUJO:{
      PEDIR_DIRECCION:'templateDirecciones',
      DIRECCION_SELECCIONADA:'direccion_seleccionada',
      POST_PEDIDO:'post_pedido',
      PEDIR_TELEFONO:'pedir_telefono',
      TELEFONO_SELECCIONADO:'telefono_seleccionado',
      PEDIR_HORARIO_ENVIO:'pedir_horario_envio',
      HORARIO_ENVIO_GUARDADO:'horario_envio_guardado'
  },
  NOMBRE_BOT:'HERBIE',
  IMG_INSTRUCCIONES:`https://restaurante-saborperuano.netlify.com/instrucciones.jpg`,
  REPARTO:{
    HORA_INICIO:'11:00 AM',
    HORA_FIN:'3:00 PM'
  },
  NOMBRE_EMPRESA:'Restaurante Sabor Peruano'
}
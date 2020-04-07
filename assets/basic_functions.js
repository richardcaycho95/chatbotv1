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
  getHorariosEnvio: function(){
    // let hours_qr = []

    // let today = new Date()
    // today.setHours(today.getHours()-5)
    // let finally_hours = true

    // let hour_end=23
    // let hour_start=21

    // let i_h=0
    // let i_m=0
    // while (finally_hours) {
    //   if(i_m==60) {
    //     i_h++
    //     i_m = 0
    //   }
    //   let hour_now = today.getHours()+i_h
    //   let minute_now = today.getMinutes()+i_m
    //   if (hour_now<=hour_end) {
    //     if (hour_now>=hour_start && (hour_now<=hour_end && minute_now<=30)) {
    //       hours_qr.push({
    //         content_type:'text',
    //         title:`${(hour_now>hour_start)?(hour_start-hour_now):hour_now}:${minute_now} ${(hour_now>hour_start)?'PM':'AM'}`,
    //         payload:`SELECCIONAR_HORA_ENVIO--${hour_now}:${minute_now}`
    //       })
    //     }
    //     i_m+=30
    //   } else{
    //     finally_hours=false
    //   }
    // }
    let hours_qr = [
      {content_type:'text',title:'11:00 AM',payload:'1'},
      {content_type:'text',title:'11:30 AM',payload:'2'},
      {content_type:'text',title:'12:00 PM',payload:'3'},
      {content_type:'text',title:'12:30 PM',payload:'4'},
      {content_type:'text',title:'1:00 PM',payload:'5'},
      {content_type:'text',title:'1:30 PM',payload:'6'},
      {content_type:'text',title:'2:00 PM',payload:'7'},
      {content_type:'text',title:'2:30 PM',payload:'8'}
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
      TELEFONO_SELECCIONADO:'telefono_seleccionado'
  }
}
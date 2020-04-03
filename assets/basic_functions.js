module.exports={
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
  getDate:function(date=''){
    if (date=='') {
      let today = new Date()
      today.setHours(today.getHours()-5)
      let dd = String(today.getDate()).padStart(2, '0');
      let mm = String(today.getMonth() + 1).padStart(2, '0')
      let yyyy = today.getFullYear()
      let h = String(today.getHours()).padStart(2,'0')
      let m = String(today.getMinutes()).padStart(2,'0')
      let i = String(today.getSeconds()).padStart(2,'0')
      return `${yyyy}-${mm}-${dd} ${h}:${m}:${i}`
    }
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
  VERIFICATION_TOKEN:process.env.VERIFICATION_TOKEN
}
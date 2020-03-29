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
  WEBHOOK_URL:'https://vizarro.herokuapp.com'
}
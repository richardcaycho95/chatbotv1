module.exports={
  fillInFirebase: function(snapshot){
    console.log(`snapshot: ${JSON.stringify(snapshot.val())}`)
    console.log(`snapshot en object values: ${JSON.stringify(Object.values(snapshot.val()))}`)
    let temp=snapshot.val()
    let temp_return=[]
    for (const prop in temp) {
      if (temp.hasOwnProperty(prop)) {
        temp_return.push(temp[prop])
      }
    }
    //temp_return['key']=snapshot.key
    console.log(`snapshot en array: ${JSON.stringify(temp_return)}`)
    return temp_return
  },
  GMAP_API_KEY:'AIzaSyDxIn9qXbWD1lvSzHCiphSNw7_jiPK6obw'
}
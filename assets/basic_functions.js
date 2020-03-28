module.exports={
  fillInFirebase: function(snapshot){
    console.log(JSON.stringify(snapshot))
    let temp=snapshot.val()
    let temp_return=[]
    for (const prop in temp) {
      if (temp.hasOwnProperty(prop)) {
        temp_return.push(temp[prop])
      }
    }
    //temp_return['key']=snapshot.key
    return temp_return
  },
  GMAP_API_KEY:'AIzaSyDxIn9qXbWD1lvSzHCiphSNw7_jiPK6obw'
}
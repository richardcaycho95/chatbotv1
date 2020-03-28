export function fillInFirebase(snapshot){
    let temp=snapshot.val()
    let temp_return=[]
    for (const prop in temp) {
      if (temp.hasOwnProperty(prop)) {
        temp_return.push(temp[prop])
      }
    }
    return temp_return
}
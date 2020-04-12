const { Client } = require('pg')
class PgDatabase{
    constructor(schema='public'){
        this.client = new Client({
            connectionString:process.env.DATABASE_URL,
            ssl: { rejectUnauthorized: false }
        })
        this.client.connect(err =>{
            if(err) console.error('connection error',err.stack)
            else console.log('pg connected')
        })
        this.schema = schema
        this.tables ={
            usuario:'usuario',
            pedido:'pedido'
        }
    }
    insert(table,insert_object){
        let columns = Object.keys(insert_object)
        let keys=[]
        for (let i = 1; i <= columns.length; i++) { keys.push(`$${i}`) }
        let text = `INSERT INTO ${this.schema}.${table} (${columns.toString()}) VALUES (${keys.toString()}) RETURNING *`
        return new Promise((resolve,reject)=>{
            this.client.query(text,Object.values(insert_object))
            .then(res => {
                resolve(res.rows[0])
            })
            .catch(err => {
                console.error(err.stack)
                reject(err)
            })
        })
    }
    insertPedido(insert_object){
        //se comprueba si el usuario está registrado para insertar o actualizar y obtener su id(este se registrará en la tabla pedido)
        let usuario = await this.select(this.tables.usuario,[{column:'psid',value:insert_object.psid}])
        console.log(usuario)
        return new Promise((resolve,reject)=>{
            this.insert(this.tables.pedido,insert_object).then(response =>{
                resolve(response)
            })
        })
    }
    select(table,where=[]){
        let str_where = (where.length!=0)?'WHERE':''
        where.forEach((element,i) =>{
            str_where+=`${element.column}='${element.value}' ${(i==(where.length-1))?'':'AND'} `
        })
        let text = `SELECT * FROM ${this.schema}.${table} ${str_where}`
        return new Promise((resolve,reject)=>{
            this.client.query(text)
            .then(response =>{
                resolve(response.rows)
            })
        })
    }
}
module.exports = PgDatabase
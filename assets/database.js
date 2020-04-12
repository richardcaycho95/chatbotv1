const { Client } = require('pg')
const Base = require('./basic_functions')
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
    async insert(table,insert_object){
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
    async insertPedido(insert_object){
        //se comprueba si el usuario está registrado para insertar y obtener su id(este se registrará en la tabla pedido)
        let usuario = await this.select(this.tables.usuario,[{column:'psid',value:insert_object.psid}])
        if(usuario.length==0){ //si el usuario no existe, se crea
            let profile = await Base.getProfileFromFacebook(insert_object.psid)
            let new_usuario = {
                psid:insert_object.psid,
                nombres_apellidos:`${profile.first_name} ${profile.last_name}`,
                created_at:Base.getDate(),
                _key:insert_object.usuario_key
            }
            usuario = await this.insert(this.tables.usuario,new_usuario)
        }
        console.log('aqui viene el usuario')
        console.log(usuario)
        insert_object.id_usuario = usuario.id_usuario
        delete insert_object.psid //se elimina porque no se va a registrar
        console.log(insert_object)

        return new Promise((resolve,reject)=>{
            let response = this.insert(this.tables.pedido,insert_object)
            resolve(response)
        })
    }
    async select(table,where=[]){
        let str_where = (where.length!=0)?'WHERE ':''
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
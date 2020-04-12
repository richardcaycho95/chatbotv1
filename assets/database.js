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
    select(table){
        let text = `SELECT * FROM ${this.schema}.${table}`
        return new Promise((resolve,reject)=>{
            this.client.query(text)
            .then(response =>{
                resolve(response.rows)
            })
        })
    }
}
module.exports = PgDatabase
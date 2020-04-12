module.exports = {
    /**
     * inserta un registro a la bd y retorna el id
     * @param {Object} client Objeto cliente, instancia de db
     * @param {Object} insert_object Objeto que contiene la información a registrar ej: {column_name:value_to_insert}
     */
    INSERT:function (client,table,insert_object) {
        let keys=[]
        let columns = Object.keys(insert_object).toString()
        for (let i = 1; i <= columns.length; i++) {
            keys.push(`$${i}`)
        }
        let text = `INSERT INTO public.${table} ${columns} VALUES (${keys.toString()}) RETURNING *`
        return new Promise((resolve,reject)=>{
            client.query(text,Object.values(insert_object))
            .then(res => {
                console.log(res)
                resolve(res.rows[0])
            })
            .catch(err => {
                console.error(err.stack)
                reject(err)
            })
        })
    }
}
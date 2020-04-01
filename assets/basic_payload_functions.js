//MODULO QUE TIENE TODAS LAS FUNCIONES QUE GENERAN PAYLOAD INICIAL (LOS QUE NO LLEVAN DATA DESPUES DEL "--") Y QUE POR LO GENERAL SE DAN EN EL TEMPLATE INICIAL
//import * as BaseJson from './basic_json_functions'
const BaseJson = require('./basic_json_functions')
module.exports = {
    getEntradas:function(){
        let data=[{'title':'CALDO DE GALLINA',}]
    },
    //return array: [0]=> response del menu,[1]=>response de los botones de accción
    //se debe leer con bucle
    getMenuDia:function(){
        let responses=[]
        data={
            'dia': '2 DE MARZO',
            'entradas':['🍜 CALDO DE GALLINA','🐟 CEVICHE','🍣 ENSALADA DE PALTA'],
            'segundos':['✅ ESTOFADO DE POLLO CON PAPAS','✅ ARROZ CON PATO','✅ TALLARINES VERDES CON BISTECK']
        };
        let entradas_text='';
        let segundos_text='';
        //formato de lista de entradas
        data.entradas.map((entrada)=>{
            entradas_text+=entrada+'\n';
        });
        //formato de lista de segundos
        data.segundos.map((segundo)=>{
            segundos_text+=segundo+'\n';
        });
        // responses.push({'text': `📌 ESTE ES EL MENÚ DEL DIA DE HOY ${data.dia}😋 \n\nENTRADAS:\n${entradas_text}\nSEGUNDOS:\n${segundos_text}`})
        // //responses.push(getAccion(MENU))
        // return responses;
        return {'text': `📌 ESTE ES EL MENÚ DEL DIA DE HOY ${data.dia}😋 \n\nENTRADAS:\n${entradas_text}\nSEGUNDOS:\n${segundos_text}`}
    },
    getComplementos:function(){
        let responses=[]
        data={
            'gaseosas':[
                {'descripcion':'✅ PERSONAL 410 ml','img_url':'https://www.cocacoladeperu.com.pe/content/dam/journey/pe/es/private/historias/bienstar/inca.rendition.598.336.jpg','precio':'S/. 1.50'},
                {'descripcion':'✅ GORDITA O JUMBO 625ml','img_url':'https://www.cocacoladeperu.com.pe/content/dam/journey/pe/es/private/historias/bienstar/inca.rendition.598.336.jpg','precio':'S/. 3.00'},
                {'descripcion':'✅ 1 LITRO','img_url':'https://www.cocacoladeperu.com.pe/content/dam/journey/pe/es/private/historias/bienstar/inca.rendition.598.336.jpg','precio':'S/. 5.00'},
                {'descripcion':'✅ 1 LITRO Y MEDIO','img_url':'https://www.cocacoladeperu.com.pe/content/dam/journey/pe/es/private/historias/bienstar/inca.rendition.598.336.jpg','precio':'S/. 7.00'}
            ],
            'mensaje_inicial':'📌 TENEMOS GASEOSAS INCA KOLA Y COCA COLA 😀\n(desliza a la derecha para verlos :) )'
        }
        responses.push({'text': data.mensaje_inicial})
    
        elements=[];
        data.gaseosas.map((gaseosa)=>{
            //creamos los elementos de los productos
            elements.push({
                'title':gaseosa.descripcion,
                'image_url':gaseosa.img_url,
                'subtitle':'Precio: '+gaseosa.precio
            })
        })
        //creamos el mensaje donde tendrá todos los elementos
        responses.push(getGenericBlock(elements))
        //agregamos la acción
        responses.push(getAccion(GASEOSA))
        return responses;
    },
    getPostres:function(){
        let responses=[]
        data={
            'postres':[
                {'descripcion':'✅ FLAN','img_url':'https://dulcesperu.com/wp-content/uploads/2019/10/receta-del-flan-con-gelatina-lonchera.jpg','precio':'S/. 1.50'},
                {'descripcion':'✅ GELATINA','img_url':'https://dulcesperu.com/wp-content/uploads/2019/10/receta-del-flan-con-gelatina-lonchera.jpg','precio':'S/. 1.00'},
                {'descripcion':'✅ GELATINA CON FLAN','img_url':'https://dulcesperu.com/wp-content/uploads/2019/10/receta-del-flan-con-gelatina-lonchera.jpg','precio':'S/. 1.00'},
                {'descripcion':'✅ MARCIANOS','img_url':'https://dulcesperu.com/wp-content/uploads/2019/10/receta-del-flan-con-gelatina-lonchera.jpg','precio':'S/. 1.00'},
            ],
            'mensaje_inicial':`📌 ESTOS SON NUESTROS POSTRES\n(desliza a la derecha para verlos :) )`
        }
        elements=[]
    
        responses.push({'text': data.mensaje_inicial})
        data.postres.map((postre)=>{
            //elementos de los postres
            elements.push({
                "title":postre.descripcion,
                "image_url":postre.img_url,
                "subtitle":"Precio: "+postre.precio
            })
        })
        //creamos el mensaje donde tendrá todos los elementos
        responses.push(BaseJson.getGenericBlock(elements))
        //agregamos la acción
        responses.push(BaseJson.getAccion(POSTRE))
        return responses;
    },
    //bloque que debe aparecer despues de cada consulta a menu,gaseosa o postre
    //tipo:{menu,gaseosa,postre}, para enviar a la pagina web qué está pidiendo primero
}
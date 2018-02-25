var connect     = require('connect');
var modRewrite  = require('connect-modrewrite');
var favicon     = require('serve-favicon');
var serveStatic = require('serve-static');
var bodyParser  = require('body-parser');
var Rest        = require('connect-rest');
var config      = require('config');
var cors        = require('cors');
var _           = require('underscore');
var app         = connect();

var options     = {
	contex: '/api',
	logger: { file: 'shoppinglist.log', level: 'warn' }
};

var rest = Rest.create( options );

var corsOptions = {
	exposedHeaders: ['X-Total-Count']
};

var SerialPort  = require('serialport');
var serialPort  = new SerialPort('/dev/ttyS3', {
                  baudRate: 19200
    });

var Printer     = require('thermalprinter');

async function printMeals(request, content) {
  console.log('printRecipe');
  //console.log(content.print);
  await serialPort.on('open', function() {
    console.log('serialPort on');
    var printer = new Printer(serialPort);
    return printer;
  });
}

app.use(cors(corsOptions));
app.use(bodyParser.urlencoded({ extended: true}));
app.use(bodyParser.json());
app.use(rest.processRequest());
app.use(modRewrite(
  [
    '!\\.html|\\.js|\\.css|\\.png|\\.jpg|\\.eot|\\.otf|\\.svg|\\.ttf|\\.woff$ /index.html [L]',
  ]
));

// Some mysql functions
var mysql       = require('promise-mysql');
var pool        = mysql.createPool(config.get('Customer.dbConfig'));

// ********************************************************************************
// Some functions for Purchaselist
// ********************************************************************************
async function getPurchases(request, content) {
	var sqlAllItemsFromList = 'select c.name as category,c.position as position,i.name as item,l.quantity,i.id from item i,category c,list l where l.item = i.id and c.id = i.category and l.quantity>0 order by c.position';;
	console.log("get Purchase List");
	const sql = await mysql.format(sqlAllItemsFromList);
	const row = await pool.query(sql);
	console.log(     _.map(_.groupBy(row, 'category'), function(key,items){ return { category: items, content: key} })       );
	return _.map(_.groupBy(row, 'category'), function(key,items){ return { category: items, content: key} });
	//return _.groupBy(row, 'category');
	//return row;
}

async function addPurchases(request, content) {
	console.log('add Purchases');
	var sqlQuery = 'INSERT INTO list SET item=? ON DUPLICATE KEY UPDATE quantity=quantity+1';
	var sql   = await mysql.format(sqlQuery, request.parameters.id);
	//console.log(sql);
	const row = await pool.query(sql);
	return row;
}

async function updatePurchases(request, content) {
	console.log('update Purchases');
	if (content.plusone !== undefined) {
		/* Prepare Queries */
		var sqlQuery = 'UPDATE list SET quantity=quantity+1 WHERE item=?';
	} 
	if (content.minusone !== undefined && content.quantity>1) {
		/* Prepare Queries */
		var sqlQuery = 'UPDATE list SET quantity=quantity-1 WHERE item=?';
	} 
	var sql   = await mysql.format(sqlQuery, request.parameters.id);
	//console.log(sql);
	const row = await pool.query(sql);
	return row;
}

async function deletePurchases(request, content) {
	if (request.parameters.id) {
		var sqlQuery = 'DELETE FROM list WHERE item = ?';
		const sql = await mysql.format(sqlQuery, request.parameters.id);
		const row = await pool.query(sql);
		return row;
	} else {
		var sqlQuery = 'TRUNCATE TABLE list';
		const sql = await mysql.format(sqlQuery, request.parameters.id);
		const row = await pool.query(sql);
		return row;
	};
}

// ********************************************************************************
// Some functions for Category
// ********************************************************************************
async function getCategories(request, content) {
	if (request.parameters.id) {
		var sqloneCategory = 'SELECT id, name, position FROM category WHERE id = ?';
		const sql = await mysql.format(sqloneCategory, request.parameters.id);
		const row = await pool.query(sql);
		return row;
		
	} else {
		var sqlAllItemsFromList = 'SELECT id, name, position FROM category order by position';
		//console.log(req);
		const sql = await mysql.format(sqlAllItemsFromList);
		const row = await pool.query(sql);
		return row;
	};
}

async function updateCategories(request, content) {
	console.log('update Categories');
	var sqlQuery = 'UPDATE category SET ? WHERE id=?';
	var sql   = await mysql.format(sqlQuery, [content.update, request.parameters.id]);
	//console.log(sql);
	const row = await pool.query(sql);
	return row;
}

async function deleteCategories(request, content) {
	var sqlQuery = 'DELETE FROM category WHERE id = ?';
	var sql   = await mysql.format(sqlQuery, request.parameters.id);
	//console.log(sql);
	const row = await pool.query(sql);
	return row;
}

async function addCategories(request, content) {
	var sqlQuery = 'INSERT INTO category SET ?';
	var sql   = await mysql.format(sqlQuery, content.add);
	//console.log(sql);
	const row = await pool.query(sql);
	return row;
}
// ********************************************************************************
// Same functions for Products
// ********************************************************************************

async function getItems ( request, content ) {
        var resData = {};
	//console.log(request.parameters);
	if (request.parameters.id) {
		console.log('Single Request');
		var sqlQuery = 'SELECT i.id as id, i.name as name, c.id as category FROM item i, category c WHERE c.id = i.category AND i.id = ?';
		const sql = await mysql.format(sqlQuery, [
			parseInt(request.parameters.id)
		]);
		const row = await pool.query(sql);
		//console.log(row);
		return row;
	} else {
		console.log('List Request');
		const sqlQuerySrc = 'SELECT COUNT(*) as anzahl FROM item WHERE name like ?';
		//console.log(sqlQuerySrc);
		const sqlCountSrc = await mysql.format(sqlQuerySrc,[
			request.parameters.where
			]);
		//console.log("SQL: " + sqlCountSrc);
		const count = await pool.query(sqlCountSrc);
		//console.log(count);
		//var sqlQuery = 'SELECT i.id as id, i.name as name FROM item i WHERE i.name like ? order by ? LIMIT ?, ?';
		var sqlQuery = 'SELECT i.id as id, i.name as name, l.quantity as quantity FROM item i LEFT JOIN list l ON (i.id = l.item) WHERE i.name like ? order by ? LIMIT ?, ?';
		const sql = await mysql.format(sqlQuery, [
			request.parameters.where,
			request.parameters.orderBy,
			parseInt(request.parameters.page)*parseInt(request.parameters.items)-parseInt(request.parameters.items), 
			parseInt(request.parameters.items)
		]);
		//console.log("SQL: " + sql);
		const rows = await pool.query(sql);
                var opt = {};
                opt.headers = { "X-Total-Count": count[0].anzahl };
		return { result: rows, options: opt };
	}
};

async function addProductData(request, content) {
	var sqlQuery = 'INSERT INTO item SET ?';
	var sql   = await mysql.format(sqlQuery, content.add);
	//console.log(sql);
	const row = await pool.query(sql);
	return row;
}

async function updateProductData(request, content) {
	console.log('update Item');
	var sqlQuery = 'UPDATE item SET ? WHERE id=?';
	var sql   = await mysql.format(sqlQuery, [content.update, request.parameters.id]);
	//console.log(sql);
	const row = await pool.query(sql);
	return row;
}

async function deleteProductData(request, content) {
	var sqlQuery = 'DELETE FROM item WHERE id = ?';
	var sql   = await mysql.format(sqlQuery, request.parameters.id);
	//console.log(sql);
	const row = await pool.query(sql);
	return row;
}

// ********************************************************************************
// Some functions for Meals
// ********************************************************************************
async function getMeals ( request, content ) {
        var resData = {};
	//console.log(request.parameters);
	if (request.parameters.id) {
		console.log('Single Request');
		var sqlQuery = 'SELECT meal_id, meal_name FROM meal WHERE meal_id = ?';
		const sql = await mysql.format(sqlQuery, [
			parseInt(request.parameters.id)
		]);
		const row = await pool.query(sql);
		//console.log(row);
		return row;
	} else {
		console.log('List Request');
		const sqlQuerySrc = 'SELECT COUNT(*) as anzahl FROM meal WHERE meal_name like ?';
		//console.log(sqlQuerySrc);
		const sqlCountSrc = await mysql.format(sqlQuerySrc,[
			request.parameters.where
			]);
		//console.log("SQL: " + sqlCountSrc);
		const count = await pool.query(sqlCountSrc);
		//console.log(count);
                //var anz = JSON.parse(JSON.stringify(count));
		//console.log('3 ' + anz[0].anzahl);
		//console.log('4 ' + count[0].anzahl);

		//var sqlQuery = 'SELECT meal_id, meal_name FROM meal WHERE meal_name like ? order by ?? LIMIT ?, ?';
		var sqlQuery = 'SELECT t2.meal_id, t2.meal_name, t1.meal_id as menu FROM menu as t1 right join meal as t2 on t1.meal_id=t2.meal_id WHERE t2.meal_name like ? order by ?? LIMIT ?, ?';
		const sql = await mysql.format(sqlQuery, [
			request.parameters.where,
			request.parameters.orderBy,
			parseInt(request.parameters.page)*parseInt(request.parameters.items)-parseInt(request.parameters.items), 
			parseInt(request.parameters.items)
		]);
		//console.log("SQL: " + sql);
		const rows = await pool.query(sql);
                var opt = {};
                opt.headers = { "X-Total-Count": count[0].anzahl };
		//console.log(opt);
		//console.log(JSON.stringify(fields));
		
		return { result: rows, options: opt };
	}
};

async function postMeals ( request, content ) {
	console.log('postMeals');
	var sqlQuery = 'INSERT INTO meal SET ?';
	var sql = await mysql.format(sqlQuery, content.add);
	var res = await pool.query(sql);
	return res;
};

async function putMeals ( request, content ) {
	console.log('putMeals');
	var sqlQuery = 'UPDATE meal SET ? WHERE meal_id=?';
	var sql = await mysql.format(sqlQuery, [content.update, request.parameters.id]);
	var res = await pool.query(sql);
	return res;
};

async function deleteMeals ( request, content ) {
	console.log('deleteMeals');
	var sqlQuery = 'DELETE FROM meal WHERE meal_id=?';
	var sql = await mysql.format(sqlQuery, request.parameters.id);
	var res = await pool.query(sql);
	return res;
};

// ********************************************************************************
// Some functions for Meals
// ********************************************************************************
async function getMealsForMenu ( request, content ) {
	console.log('getMealsForMenu');
	var sqlQuery = 'SELECT meal.meal_id as meal_id, meal.meal_name as meal_name FROM menu, meal WHERE menu.meal_id=meal.meal_id';
	var sql = await mysql.format(sqlQuery);
	var res = await pool.query(sql);
	return res;
};

async function deleteMealsForMenu ( request, content ) {
	console.log('deleteMealsForMenu');
        if ( request.parameters.id ) {
	  var sqlQuery = 'DELETE FROM menu WHERE meal_id=?';
	  var sql = await mysql.format(sqlQuery, request.parameters.id);
        } else {
	  var sqlQuery = 'DELETE FROM menu';
	  var sql = await mysql.format(sqlQuery);
        }
	var res = await pool.query(sql);
	return res;
};

async function putMealsForMenu ( request, content ) {
	console.log('addMealsForMenu');
	var sqlQuery = 'INSERT INTO menu SET meal_id=?';
	var sql = await mysql.format(sqlQuery, request.parameters.id);
	var res = await pool.query(sql);
	return res;
};



// Some functions for Units
function getUnitListData(request, content, callback) {
	if (!request.parameters.id) {
		//console.log('run getUnitListData ohne ID');
		var sqlQuery = 'SELECT unit_id, unit_name FROM unit';
		var sql = mysql.format(sqlQuery);
		//console.log(sql);
	} else {
		//console.log('run getUnitListData mit ID');
		var sqlQuery = 'SELECT i.id as id, i.item_id AS unit_id, u.unit_name AS unit_name FROM  `item_unit` i,  `unit` u WHERE i.unit_id = u.unit_id AND item_id = ?';
		var sql = mysql.format(sqlQuery, request.parameters.id);
		//console.log(sql);
	}
	pool.query(sql, function(err, data) {
		callback(err, data);
		//console.log(resData);
	});
};

function postUnitData(request, content, callback) {
	//console.log("postUnitData")
	// Hinzufügen
	if (content.add!==undefined) {
		//console.log("Add")
		/* Prepare Queries */
		var sqlQuery = 'INSERT INTO item_unit SET ?';
		//console.log(request);
		//console.log(content.add);
		var sql = mysql.format(sqlQuery, content.add);
		//console.log(sql);
	}
	// Entfernen
	if (content.delete!==undefined) {
		/* Prepare Queries */
		var sqlQuery = 'DELETE FROM item_unit WHERE ?';
		//console.log(request);
		//console.log(content.add);
		var sql = mysql.format(sqlQuery, [content.delete]);
		//console.log(sql);
	}
	pool.query(sql, function(err, result) {
	if (err) callback(err);
	//console.log(result);
	callback(null, result);
	});
};

// Function to test a Service
function testService(request, content, callback) {
	console.log('Receive headers: ' + JSON.stringify( request.headers ));
	console.log('Receive parameters: ' + JSON.stringify( request.parameters ));
	console.log('Receive JSON object: ' + JSON.stringify( content ));
	callback(null, 'ok');
};

// Daten für Drucker vorbereiten und in eine Datei schreiben
function print(request, content, callback){
	getShoppingList(function(shoppingList){
		console.log(shoppingList);
		if(!shoppingList) return null;
		var text = "# -*- coding: UTF-8 -*-\n\n";
		   	text += "import prints\n";
		   	text += "def printShoppingQueue(printer):\n";
		for (var categories in shoppingList) {
			//console.log('printHead("' + categories + '");');
		   	text += '\tprints.printHead(printer);\n';
		   	text += '\tprints.putLine("' + categories + '", printer);\n';
		   	text += '\tprints.printItem(printer);\n';
			//console.log(shoppingList[categories]);
			for(item in shoppingList[categories]) {
				//console.log('printItem("' + shoppingList[categories][item].item + ' x' + shoppingList[categories][item].quantity + '");');
			   	text += '\tprints.putLine("' + shoppingList[categories][item].item + ' x' + shoppingList[categories][item].quantity + '", printer);\n';
			}
		}
		var fs = require('fs');
		//console.log(text);
		var options={};
		options.encoding='UTF-8';
		fs.writeFile('../items.py', text);
	});
	var exec  = require('child_process').exec;
	var child = exec('cd .. && sudo python einkaufszettel.py', function(err, stdout, stderr){
		//console.log(err, stdout, stderr);
        callback(null, 'ok');
	});
}

// Daten für Drucker vorbereiten und in eine Datei schreiben
async function printNeu (request, content){
	toPrint = content.print;
	console.log('Inhalt', toPrint);
	if(!content.print) { return 'nothing to print'} else { console.log('if ok')};
	var text = "# -*- coding: UTF-8 -*-\n\n";
	   	text += "import prints\n";
	   	text += "def printShoppingQueue(printer):\n";
	//printer.setSize('L')
	//printer.println("Einkaufszettel")
		text += "\tprinter.setSize('L');\n";
		//text += "\tprinter.println('Menü');\n";
	   	text += '\tprints.putLine("Menü", printer);\n';
		text += "\tprinter.setSize('S');\n";
        console.log('FOR', toPrint.length);
	for(var item in toPrint) {
		console.log('in for', toPrint[item].meal_name);
	   	text += '\tprints.putLine("' + toPrint[item].meal_name + '", printer);\n';
	}
	var fs = require('fs');
	console.log('Output', text);
	var options={};
	options.encoding='UTF-8';
	var file  = await fs.writeFile('../items.py', text);
	var exec  = require('child_process').exec;
	var child = await exec('cd .. && sudo python einkaufszettel.py');
        return 'ok';
}

// RESTful
  // Shoppinglist
rest.get    (             { path: '/purchases',       unprotected: true }, getPurchases);
rest.post   (             { path: '/purchases/:id',   unprotected: true }, addPurchases);
rest.put    (             { path: '/purchases/:id',   unprotected: true }, updatePurchases);
rest.assign ( ['delete'], { path: '/purchases/?id',   unprotected: true }, deletePurchases);

  // Category
rest.get    (             { path: '/categories/?id',  unprotected: true }, getCategories);
rest.post   (             { path: '/categories',      unprotected: true }, addCategories);
rest.put    (             { path: '/categories/:id',  unprotected: true }, updateCategories);
rest.assign ( ['delete'], { path: '/categories/:id',  unprotected: true }, deleteCategories);

  // Product
rest.get    (             { path: '/items/?id',  unprotected: true }, getItems);
rest.post   (             { path: '/items',      unprotected: true }, addProductData);
rest.put    (             { path: '/items/:id',  unprotected: true }, updateProductData);
rest.assign ( ['delete'], { path: '/items/:id',  unprotected: true }, deleteProductData);

  // Meals
// sample requests:
// /api/meals                       works
// /api/meals/1                     works
// /api/meals?query=                future use, not implemented
// /api/meals?offset=10&limit=5     future use, not implemented
rest.get    (             { path: '/meals/?id',  unprotected: true }, getMeals);
rest.post   (             { path: '/meals',      unprotected: true }, postMeals);
rest.put    (             { path: '/meals/:id',  unprotected: true }, putMeals);
rest.assign ( ['delete'], { path: '/meals/:id',  unprotected: true }, deleteMeals);

  // Menus
rest.get    (             { path: '/menus',      unprotected: true }, getMealsForMenu);
rest.put    (             { path: '/menus/:id',  unprotected: true }, putMealsForMenu);
rest.assign ( ['delete'], { path: '/menus/?id',  unprotected: true }, deleteMealsForMenu);
//rest.post ('/menu', postMenuData)


  // Units
//rest.get  ('/unit', getUnitListData);
//rest.post ('/unit', postUnitData);


  // Print
rest.post   (             { path: '/print',      unprotected: true }, printNeu);
//rest.get   ('/print', printOut);

  // Testing
//rest.assign( '*', { path: '/test/:item', version: '>=1.0.0' }, testService);

// Favicon
//app.use(favicon('pictures/favicon.ico'));

// Static Content
app.use(serveStatic('../frontend'));

// run server listen
app.listen(config.get('Customer.serverPort'));
console.log("Server is running on port "+config.get('Customer.serverPort'));

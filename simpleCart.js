/****************************************************************************
Copyright (c) 2011 The Wojo Group

thewojogroup.com
simplecartjs.com
http://github.com/wojodesign/simplecart-js/tree/master

The MIT License

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
****************************************************************************/

(function(window,undefined){
	
	
var	typeof_string			= typeof "",
	typeof_undefined		= typeof undefined,
	typeof_function			= typeof function(){},
	typeof_object			= typeof {},
	isTypeOf				= function( item , type ){ return typeof item === type },
	isString				= function( item ){ return isTypeOf( item , typeof_string ); },
	isUndefined				= function( item ){ return isTypeOf( item , typeof_undefined ); },
	isFunction				= function( item ){ return isTypeOf( item , typeof_function ); },
	isObject				= function( item ){ return isTypeOf( item , typeof_object ); },
	
	
	
	
simpleCart = (function(){	

	// stealing this from selectivizr
	var selectorEngines = {
		"MooTools"							: "$$",
		"Prototype"							: "$$",
		"jQuery"							: "*"
	},
	selectorEngine,
	
	
	// local variables for internal use
	item_id 				= 1,
	item_id_namespace		= "SCI-",
	shelfitem_id			= 1,
	shelfitem_id_namespace 	= "SCS-",
	sc_items 				= {},
	namespace 				= "simpleCart",
	
	
	// Currencies
	currencies = {
		  "USD": [ "USD", "$", "US Dollar" ] 
		, "AUD": [ "AUD", "$", "Australian Dollar" ] 
	},
	
	// default options
	settings = {
		  checkout				: [ { type: "PayPal" , email: "test@test.com" } ]
		, currency				: "USD"
		, language				: "english-us"
		, cookieDuration		: 30
		
		, paypalHTTPMethod		: "GET"
		, paypalSandbox			: false
		, storagePrefix			: "sc_"
		
		, cartStyle				: "table"
		, cartColumns			: [
			  { attribute: "name" , label: "Name" }
			, { attribute: "price" , label: "Price" }
			, { view: "decrement" , label: false }
			, { attribute: "quantity" , label: "Qty" }
			, { view: "increment" , label: false }
			, { attribute: "total" , label: "SubTotal" }
			, { view: "remove" , text: "Remove" , label: false }
		]
		
		, excludeFromCheckout	: []
	
		
	}, 
	
	
	// main simpleCart object, function call is used for setting options
 	simpleCart = function( options ){
		// shortcut for simpleCart.ready
		if( isFunction( options ) ){
			return simpleCart.ready( options );
		} 
		
		// set options
		else if( isObject( options ) ){
			return simpleCart.extend( settings , options );
		}
	};
	

	// function for extending objects
	simpleCart.extend = function( target , opts ){
		
		if( isUndefined( opts ) ){
			opts = target;
			target = simpleCart;
		}
		
		for( var next in opts ){
			target[ next ] = opts[ next ];
		}
		return target;
	};
		
	// add in the core functionality 	
	simpleCart.extend({
		
		isReady: false,
		
		// this is where the magic happens, the add function
		add: function( values ){
			var info 		= values || {},
				newItem 	= new simpleCart.Item( info ),
				oldItem;
				
			// trigger before add event
			simpleCart.trigger('beforeAdd' , [ newItem ] );
			
			// if the new item already exists, increment the value
			if( oldItem = simpleCart.has( newItem ) ){
				oldItem.increment( newItem.quantity() );
				newItem = oldItem;
			}
			// otherwise add the item
			else { 
				sc_items[ newItem.id() ] = newItem ;
			}
			
			// update the cart 
			simpleCart.update();
			
			// trigger after add event
			simpleCart.trigger( 'afterAdd' , [ newItem , isUndefined( oldItem ) ] );
			
			// return a reference to the added item
			return newItem;
		},
		
		
		// iteration function 
		each: function( array , callback ){
			var next,
				x=0, 
				result;

			if( isFunction( array ) ){
				var cb = array,
					items = sc_items;
			} else if( isFunction( callback ) ){
				var cb = callback,
					items = array;
			} else {
				return;
			}

			for( next in items ){
				if( !isFunction( items[next] ) ){
					result = cb.call( simpleCart , items[next] , x , next );
					if( result === false ){
						return;
					}
					x++;
				}
			}
		},
		
		// check to see if item is in the cart already
		has: function( item ){
			var current, 
				matches,
				field,
				match=false;

			simpleCart.each(function(testItem){ 
				matches = true;
				simpleCart.each( item , function( value , x , field ){ 
					if( field !== "quantity" && field !== "id" && item[field] !== testItem[field] ){
						matches = false;
					}
				});

				if( matches ){
					match = testItem;
				}

			});
			return match;
		},
		
		// empty the cart
		empty: function(){
			sc_items = {};
			simpleCart.update();
		},
		
		
		// functions for accessing cart info
		quantity: function(){
			var quantity = 0;
			simpleCart.each(function(item){
				quantity+=item.quantity();
			});
			return quantity;
		},
		
		total: function(){
			var total = 0;
			simpleCart.each(function(item){
				total+=item.total();
			});
			return total;
		},
		
		
		// updating functions
		update: function(){
			simpleCart.save();
			simpleCart.trigger("update");
		},
		
		init: function(){
			simpleCart.load();
			simpleCart.update();
			simpleCart.ready();
		},
				
		// view management
		$: function( selector ){
			return new simpleCart.ELEMENT( selectorEngine( selector ) );
		},
		
		setupViewTool: function(){
			// Determine the "best fit" selector engine
			for (var engine in selectorEngines) {
				var members, member, context = window;
				if (window[engine]) {
					members = selectorEngines[engine].replace("*", engine).split(".");
					while ((member = members.shift()) && (context = context[member])) {}
					if (typeof context == "function") {
						// set the selector engine and extend the prototype of our 
						// element wrapper class
						selectorEngine = context;
						simpleCart.extend( simpleCart.ELEMENT._ , selectorFunctions[ engine ] );
						return;
					}
				}
			}
		}, 
		
		
		// storage 
		save: function(){
			simpleCart.trigger('beforeSave');
			
			// TODO: save
			
			simpleCart.trigger('afterSave');
		}, 
		
		load: function(){
			// TODO: load
			simpleCart.trigger('load');
		},
		
		// ready function used as a shortcut for bind('ready',fn)
		ready: function(fn){
			
			if(isFunction( fn )){ 
				// call function if already ready already
				if( simpleCart.isReady ){
					fn.call(simpleCart);
				} 
				// bind if not ready
				else {
					simpleCart.bind( 'ready' , fn );
				}
			}
			
			// trigger ready event
			else if( isUndefined(fn) && !simpleCart.isReady ){
				simpleCart.trigger('ready');
				simpleCart.isReady = true;
			}
			
		},
		
		// bind ready event used from jquery
		bindReady: function() {

			// Catch cases where $(document).ready() is called after the
			// browser event has already occurred.
			if ( document.readyState === "complete" ) {
				// Handle it asynchronously to allow scripts the opportunity to delay ready
				return setTimeout( simpleCart.init, 1 );
			}

			// Mozilla, Opera and webkit nightlies currently support this event
			if ( document.addEventListener ) {
				// Use the handy event callback
				document.addEventListener( "DOMContentLoaded", DOMContentLoaded, false );

				// A fallback to window.onload, that will always work
				window.addEventListener( "load", simpleCart.init, false );

			// If IE event model is used
			} else if ( document.attachEvent ) {
				// ensure firing before onload,
				// maybe late but safe also for iframes
				document.attachEvent( "onreadystatechange", DOMContentLoaded );

				// A fallback to window.onload, that will always work
				window.attachEvent( "onload", simpleCart.init );

				// If IE and not a frame
				// continually check to see if the document is ready
				var toplevel = false;

				try {
					toplevel = window.frameElement == null;
				} catch(e) {}

				if ( document.documentElement.doScroll && toplevel ) {
					doScrollCheck();
				}
			}
		} , 
		
		
		// basic structure for cart column 
		cartColumn: {
			  attr			: "" 
			, label			: "" 
			, view			: "attr"
			, text			: ""
			, className		: ""
			, hide			: false
		} ,
		
		// built in cart views for item cells
		cartColumnViews: {
			  attr		 	: function( item , column ){ 
				return item[column.attr] || "";
			}
			, link			: function( item , column ){
				return "<a href='" + item[column.attr] + "'>" + column.text + "</a>";
			} 
			, decrement 	: function( item , column ){
				return "<a href='javascript:;' class='simpleCart_decrement'>" + ( item[column.text] || "-" ) + "</a>";
			}
			, increment 	: function( item , column ){
				return "<a href='javascript:;' class='simpleCart_increment'>" + ( item[column.text] || "+" ) + "</a>";
			}
			, image			: function( item , column ){
				return "<img src='" + item[column.attr] + "'/>"
			}
			, input			: function( item , column ){
				return "<input type='text' value='" + item[column.attr] + "' class='simpleCart_input'/>";
			} 
			, remove 		: function( item , column ){
				return "<a href='javascript:;' class='simpleCart_remove'>" + ( item[column.text] || "X" ) + "</a>";
			}
		} ,
		
		cartCellView: function( item , column ){
			var viewFunc = isFunction( column.view ) ? column.view :
							isString( column.view ) && isFunction( simpleCart.cartColumnView[ column.view ] ) ? simpleCart.cartColumnView[ column.view ] :
							simpleCart.cartColumnView['attr'];
							
			return viewFunc.call( simpleCart , item , column );
		} , 
		
		// write out cart
		writeCart: function(){
			var TABLE = settings.cartStyle,
				isTable = TABLE === 'table',
				TR = isTable ? "tr" : "div",
				TH = isTable ? 'th' : 'div',
				TD = isTable ? 'td' : 'div',
				cart_container = simpleCart.$create( TABLE ),
				header_container = simpleCart.$create( TR ).addClass('headerRow');
				
			// create header 
			for( var x=0,xlen = settings.cartColumns.length; x<xlen; x++ ){
				var column = settings.cartColumns[x],
					klass =  "item-" + (column.attr || column.view || column.label || column.text || "cell" ) + " " + column.className,
					label = cart.label || "";
					
				// append the header cell
				header_container.append(
					simpleCart.$create( TH ).addClass( klass ).html( label )
				);
			}
			cart_container.append( header_container );
			
			// cycle through the items
			simpleCart.each( function( item, y ){
				var row = simpleCart.$create( TR )
									.addClass( 'itemRow row-' + y + " " + ( y%2 ? "even" : "odd" )  )
									.attr('id' , "cartItem-" + item.id() ),
					itemObject = item.toObject();
					
				// cycle through the columns to create each cell for the item
				for( var j=0,jlen=settings.cartColumns.length; j<jlen; j++ ){
					var column = settings.cartColumns[ j ],
						klass =  "item-" + (column.attr || column.view || column.label || column.text || "cell" ) + " " + column.className,
						content = simpleCart.cartCellView( item , column ),
						cell = simpleCart.$create( TD ).addClass( klass ).html( content );
					
					row.append( cell );
				}
				cart_container.append( row );
			});
			
			return cart_container;
		}
		
		
		
	});
	
	
	
	
	// class for cart items
	var Item = simpleCart.Item = function( info ){
		
		// we use the data object to track values for the item
		var _data = {},
			me = this;
			
		// cycle through given attributes and set them to the data object
		if( isObject( info ) ){
			simpleCart.extend( _data , info );	
		}
			
		// set the item id
		_data.id = _data.id || item_id_namespace + (++item_id); 
		while( !isUndefined( sc_items[_data.id] ) ){
			_data.id = item_id_namespace + (++item_id); 
		}
		
		// getter and setter methods to access private variables
		me.get = function( name , usePrototypes ){
			
			usePrototypes = isUndefined( usePrototypes ) && usePrototypes;
			
			if( isUndefined( name ) ){
				return name;
			}
			
			// return the value in order of the data object and then the prototype 	
			return 	isFunction( _data[name] ) 	? _data[name].call(me) : 
					!isUndefined( _data[name] ) ? _data[name] :
					
					isFunction( me[name] ) && usePrototypes		? me[name].call(me) :
					!isUndefined( me[name] ) && usePrototypes	? me[name] :
					_data[name];
		};
		me.set = function( name , value ){
			if( !isUndefined( name ) ){
				_data[name] = value;
			}
			return me;
		};
	};
	
	Item._ = Item.prototype = {
		
		// editing the item quantity
		increment: function( amount ){
			var diff = amount || 1;
			diff = parseInt( diff , 10);
			
			this.quantity( this.quantity() + diff );
			if( this.quantity() < 1 ){
				this.remove();
				return null;
			}
			return this;

		},
		decrement: function( amount ){
			var diff = amount || 1;
			return this.increment( -parseInt( diff , 10 ) );
		},
		remove: function(){
			delete sc_items[this.id()];
			simpleCart.update();
			return null;
		},
		
		
		
		// shortcuts for getter/setters. can
		// be overwritten for customization
		quantity: function( val ){
			return isUndefined( val ) ? parseInt( this.get("quantity",false) || 1 , 10 ) : this.set("quantity", val );
		},
		price: function( val ){
			return isUndefined( val ) ? parseFloat(  this.get("price",false) || 1 ) : this.set("price", val );
		},
		id: function(){
			return this.get( 'id',false );
		},
		total:function(){
			return this.quantity()*this.price();
		}
		
	};
	
	
	
	// Event Management
	var eventFunctions = {

		// bind a callback to an event
		bind: function( name , callback ){
			if( !isFunction( callback ) ){
				return this;
			}
			
			if( !this._events ){
				this._events = {};
			}

			if (this._events[name] === true ){
				callback.apply( this );
			} else if( !isUndefined( this._events[name] ) ){
				this._events[name].push( callback );
			} else {
				this._events[name] = [ callback ];
			}
			return this;
		},

		// trigger event
		trigger: function( name , options ){
			var returnval = true;
			if( !this._events ){
				this._events = {};
			}
			if( !isUndefined( this._events[name] ) && isFunction( this._events[name][0] ) ){
				for( var x=0,xlen=this._events[name].length; x<xlen; x++ ){
					returnval = this._events[name][x].apply( this , (options ? options : [] ) );
				}
			}
			if( returnval === false ){
				return false;
			} else {
				return true;
			}
		}
		
	};
	simpleCart.extend( eventFunctions );
	simpleCart.extend( simpleCart.Item._ , eventFunctions );
	
	
	// basic simpleCart events
	var emptyFunc = function(){} ,
		events = 	{ 'beforeAdd' 			: emptyFunc
					, 'afterAdd' 			: emptyFunc
					, 'load' 				: emptyFunc
					, 'beforeSave' 			: emptyFunc
					, 'afterSave' 			: emptyFunc
					, 'update' 				: emptyFunc
					, 'ready' 				: emptyFunc
					, 'checkoutSuccess' 	: emptyFunc
					, 'checkoutFail' 		: emptyFunc
					, 'checkout'			: emptyFunc
				};
			
	// extend events in options
	simpleCart.extend( events );
	
	//bind settings to events
	simpleCart.each( events , function( val , x , name ){
		simpleCart.bind( name , function(){
			if( isFunction( settings[name] ) ){
				settings[ name ].apply( this , arguments );
			}
		});
	});
					
					
					

	
	// class for wrapping DOM selector shit
	var ELEMENT = simpleCart.ELEMENT = function( el ){
		this.el = el;
	},
	
	_VALUE_ 	= 'value',
	_TEXT_	 	= 'text',
	_HTML_ 		= 'html',
	
	selectorFunctions = {
		
		"MooTools"		: {
			text: function( text ){
				return this.attr( _TEXT_ , text );
			} ,
			html: function( html ){
				return this.attr( _HTML_ , html );
			} ,
			val: function( val ){
				return this.attr( _VALUE_ , val );
			} ,
			attr: function( attr , val ){
				if( isUndefined( val ) ){
					return this.el.get( attr )
				} else { 
					this.el.set( attr , val );
					return this;
				}
			} ,
			remove: function(){
				this.el.dispose();
				return null;
			} , 
			addClass: function( klass ){
				this.el.addClass( klass );
				return this;
			} ,
			removeClass: function( klass ){
				this.el.removeClass( klass );
				return this;
			}
		},
		
		"Prototype"		: {
			text: function( text ){
				if( isUndefined( text ) ){ 
					return this.el.innerHTML; 
				} else {
					this.el.update( text );	
					return this;
				} 
			} ,
			html: function( html ){
				return this.text( selector , html );
			} ,
			val: function( val ){
				return this.attr( selector , _VALUE_ , val );
			} ,
			attr: function( attr , val ){
				if( isUndefined( val ) ){	
					return this.el.readAttribute( attr );
				} else {
					this.el.writeAttribute( attr , val );
					return this;
				}
			} ,
			remove: function(){
				this.el.remove();
				return this;
			} ,
			addClass: function( klass ){
				this.el.addClassName( klass );
				return this;
			} , 
			removeClass: function( klass ){
				this.el.removeClassName( klass );
				return this;
			}
			
		},
		
		"jQuery"		: {
			passthrough: function( action , val ){
				if( isUndefined( val ) ){
					return this.el[action]();
				} else {
					this.el[action]( val );
					return this;
				}
			},
			text: function( text ){
				return this.passthrough( _TEXT_ , text );
			} ,
			html: function( html ){
				return this.passthrough( _HTML_ , html );
			} ,
			val: function( val ){
				return this.passthrough( _VAL_ , val );
			} ,
			attr: function( attr , val ){
				if( isUndefined( val ) ){
					return this.el.attr( attr );
				} else {
					this.el.attr( attr , val );
					return this;
				} 
			} ,
			remove: function(){
				this.el.remove();
				return this;
			} ,
			addClass: function( klass ){
				this.el.addClass( klass );
				return this;
			} , 
			removeClass: function( klass ){
				this.el.removeClass( klass );
				return this;
			}
		}
	};
	ELEMENT._ = ELEMENT.prototype;
	
	// bind the DOM setup to the ready event
	simpleCart.ready( simpleCart.setupViewTool );


	// Cleanup functions for the document ready method
	// used from jQuery
	if ( document.addEventListener ) {
		DOMContentLoaded = function() {
			document.removeEventListener( "DOMContentLoaded", DOMContentLoaded, false );
			simpleCart.init();
		};

	} else if ( document.attachEvent ) {
		DOMContentLoaded = function() {
			// Make sure body exists, at least, in case IE gets a little overzealous (ticket #5443).
			if ( document.readyState === "complete" ) {
				document.detachEvent( "onreadystatechange", DOMContentLoaded );
				simpleCart.init();
			}
		};
	}
	// The DOM ready check for Internet Explorer
	// used from jQuery
	function doScrollCheck() {
		if ( simpleCart.isReady ) {
			return;
		}

		try {
			// If IE is used, use the trick by Diego Perini
			// http://javascript.nwbox.com/IEContentLoaded/
			document.documentElement.doScroll("left");
		} catch(e) {
			setTimeout( doScrollCheck, 1 );
			return;
		}

		// and execute any waiting functions
		simpleCart.init();
	}
	
	// bind the ready event
	simpleCart.bindReady();	
	
	return simpleCart;
}());


	

window.simpleCart = simpleCart;
}(window));

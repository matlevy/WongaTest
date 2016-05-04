#!/usr/bin/env node

/** Problem breakdown / approach

1) Break down:

	1. Open a text file;

		** 	There must be two inputs from the command the input and output file, otherwise there a problem;
			and we cannot continue;

	2. Read the file line by line;

		?? 	Should validation occur before processing >> decision: validate the entire text file and when the
			processing of the file is complete check there are no errors before processing the flight and outputing.

	3. Process each line of the file as an instruction
		i) Validate the input;
		ii) If all the lines are valid, process the instructions;

	4. Calculate totals / values etc

	5. Validate the flight meets the criteria;

	6. Write to the output file;

*/

var prog = require("commander");		// Chose to use commander package for reading command line input

const readline = require("readline");
const fs = require("fs");
	
// 1.1 : load the input file. No need to validate paraters, this is handled by commander;

var init = function( input, output ){

	console.log( [ "input: ", input, ", output: ", output ].join('') );

	const rl  = readline.createInterface({
  		input: fs.createReadStream( input )
	});

	var line_number = 0;
	var errors = [];

	var flight = {
		route: null,
		aircraft: null,
		passengers: [],
		loyalty_passengers: [],
	}

	rl.on("line",  function(line){
		try {
			line_number++;
			// Thoughts 1.3
			parse_instruction( flight, validate_instruction( line, line_number ), line_number );
		} catch( err ) {
			errors.push( err );
		}
	} );

	rl.on("close", function(){
		
		console.log( "completed reading file" );

		if( errors.length > 0 ){
			console.log( errors.join("\n") );
		} else {
			process_flight( flight );
			can_the_flight_proceed( flight );
			fs.writeFile( output, get_output( flight ) );
		}

	})

};

var parse_instruction = function( the_flight, instruction, line_number ){
	switch( instruction[2] ){
		case "route" : 
			if( the_flight.route!=null ){
				throw new SyntaxError("Line " + line_number + ". Flight route already defined.");
			}
			the_flight.route = {
				origin: instruction[3],
				destination: instruction[4],
				cost_per_passenger: Number(instruction[5]),
				ticket_price: Number(instruction[6]),
				minimum_takeoff_load_percentage: Number(instruction[7]),
			}
			break;
		case "aircraft" :
			if( the_flight.aircraft!=null ){
				throw new SyntaxError("Line " + line_number + ". Flight aircraft already defined.");
			}
			the_flight.aircraft = {
				title: instruction[3],
				number_of_seats: Number(instruction[4]),
			}
			break;
		case "loyalty" :
			var passenger = {
				first_name: instruction[3], age: Number(instruction[4]),
				is_loyal: true, is_general: false,
			}
			the_flight.loyalty_passengers.push( { 
				passenger: passenger,
				current_loyalty_points: Number(instruction[5]),
				using_loyalty_points: instruction[6]=='TRUE',
				using_extra_baggage: instruction[7]=='TRUE',
			})
			break;
		default: 
			var passenger = {
				first_name: instruction[3], age: Number(instruction[4]),
				is_loyal: false, is_general: instruction[2]=='general'
			}
			the_flight.passengers.push( passenger );
	}
}


/** 1.4 :: Process the flight and calculate the totals */
var process_flight = function( the_flight ){
	the_flight.total_passengers_count = the_flight.passengers.length + the_flight.loyalty_passengers.length;
	the_flight.general_passengers_count = count_if( the_flight.passengers, 'is_general', true );
	the_flight.airline_passengers_count = count_if( the_flight.passengers, 'is_general', false );
	the_flight.loyalty_passenger_count = the_flight.loyalty_passengers.length;
	the_flight.baggage_count = the_flight.total_passengers_count + count_if( the_flight.loyalty_passengers, 'using_extra_baggage', true);
	the_flight.loyalty_points_redeemed = sum_property_if( the_flight.loyalty_passengers, 'using_loyalty_points', true, 'current_loyalty_points');
	the_flight.total_cost_of_flight = the_flight.route.cost_per_passenger * the_flight.total_passengers_count;
	the_flight.total_revenue = the_flight.route.ticket_price * the_flight.total_passengers_count;
	the_flight.adjusted_revenue = the_flight.total_revenue - the_flight.loyalty_points_redeemed
		- (the_flight.airline_passengers_count * the_flight.route.ticket_price);
}

/** 1.5 :: determine of the flight can proceeed and update the given flight object */
var can_the_flight_proceed = function( the_flight ){
	the_flight.percentage_booked = ( the_flight.total_passengers_count / the_flight.aircraft.number_of_seats );
	the_flight.meets_revenue = ( the_flight.total_cost_of_flight < the_flight.adjusted_revenue );
	the_flight.meets_seats = ( the_flight.total_passengers_count <= the_flight.aircraft.number_of_seats );
	the_flight.meets_percentage = (the_flight.percentage_booked *100) > the_flight.route.minimum_takeoff_load_percentage;
	the_flight.can_proceed = the_flight.meets_revenue && the_flight.meets_percentage && the_flight.meets_seats;
}

/** 1.6 :: Returns the output for the flight a string in the specified format */
var get_output = function( the_flight ){
	return [ the_flight.total_passengers_count, the_flight.general_passengers_count, the_flight.airline_passengers_count,
		the_flight.loyalty_passenger_count, the_flight.baggage_count, the_flight.loyalty_points_redeemed, 
		the_flight.total_cost_of_flight, the_flight.total_revenue, the_flight.adjusted_revenue,
		the_flight.can_proceed.toString().toUpperCase() ].join(' ');
}

/**
* Utility function for counting objects in an array where the given property of an object
* must meet the criteria of the given value. If true then the count is incremented.
*
* @param	{array}		array		The array to cycle through
* @param	{string}	property 	The property to check
* @param	value 					The value to validate for
* @return	{boolean}	The count of occurances where the value matches the property value
*/	
var count_if = function( array, property, value ){
	var c = 0;
	for( var i=0; i<array.length; i++){
		c += (array[i][property] == value) ? 1 : 0;
	}
	return c;
}

/** 
*	Utility function to sum the value of a given property given that a second given property matches the
*	value of a conditional value.
*
*	@param	{array}		array				The array to cycle through
*	@param	{string}	condition_property	The property of each object in the array to validate against
*	@param	{*}			conditional_value	The value to validate against
*	@param	{string}	sum_property 		The property to sum if the condition is met
*	@return	The sum of the conditional_value where the given criteria are met
*/
var sum_property_if = function( array, condition_property, condition_value, sum_property ){
	var s = 0;
	for( var i=0; i<array.length; i++){
		s += (array[i][condition_property] == condition_value) ? array[i][sum_property] : 0;
	}
	return s;
}

// Thoughts: 1.2 : Process each line. The instruction line is validated using a regular expression and an array
// is returned matching the elements of the instruction line;

var validate_instruction = function( line, line_number ){
	
	var valid_instruction = /(add)\s(route|aircraft|general|airline|loyalty)/;

	if( valid_instruction.test( line ) ){
		var type = valid_instruction.exec( line )[2];

		switch( type ){
			case "route" :
				return validate( line, line_number, /(add)\s(route)\s([a-zA-Z]+)\s([a-zA-Z]+)\s(\d+)\s(\d+)\s(\d+)/, 
					"A route must meet the format 'add route origin destination cost-per-passenger(n) ticket-price(n) minimum-takeoff-load-percentage(n)'.");
				break;
			case "aircraft" :
				return validate( line, line_number, /(add)\s(aircraft)\s(\S+)\s(\d+)/,
					"An aircraft must meet the format 'add aircraft aircraft-title number-of-seats(n)'.")
				break;
			case "loyalty" :
				return validate( line, line_number, /(add)\s(loyalty)\s([a-zA-Z]+)\s(\d{1,3})\s(\d+)\s(TRUE|FALSE)\s(TRUE|FALSE)/,
					"An loyalty passenger must meet the format 'add loyalty first-name age(n) current-loyalty-points(n) using-loyalty-points(b) using-extra-baggage(b)'." );
				break;
			default :
				return validate( line, line_number, /(add)\s(general|airline)\s(\S+)\s(\d{1,3})/,
					"A passenger must meet the format 'add (general|airline) first-name age(n)'." ); 
		}
		return line;
	} else {
		throw new SyntaxError("Invalid instruction line (" + line_number + "). Only 'add route|aircraft|general|airline|loyalty' are permitted as a valid instruction.")
	};
}

var validate = function( instruction, line_number, validation, error_message ){
	if( validation.test( instruction ) ){
		return validation.exec( instruction );
	} else {
		throw new SyntaxError( "Invalid instruction line (" + line_number + "). " + error_message );
	}
}

prog
	.arguments("<input> <output>")
	.action( function(input, output){
		init( input, output );
	} )
	.parse( process.argv );
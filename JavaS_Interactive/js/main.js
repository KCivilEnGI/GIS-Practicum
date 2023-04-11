//create map
//declare map and minValue variables in global scope
var map;
var minValue;
var dataStats = {};  
var dark_map;
var lineLayers = {};
var baseMaps;
var attributes;
var attributes2;
var sidebar;
var count = 0;

//function to instantiate the Leaflet map
function createMap(){
    //create the map
    var dark_map = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
	        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
	        subdomains: 'abcd',
	        maxZoom: 20
        }
    );

    baseMaps = {
        "Basemap": dark_map
    };
    
    map = L.map('map', {
        layers: dark_map
    }).setView([25.05, 121.50], 12); // setView([lat, long], Zoom)

    var sidebar = L.control.sidebar('sidebar', {
        position: 'left'
    });
    map.addControl(sidebar);
    
    //load the data   
    createAll();
    sidebar.show();
    //create_bl();
       
};

function createAll(){
    fetch("data/tpeMRT_ridership.geojson")  
    .then(function(response){
        return response.json();
    })
    .then(function(json){
        attributes = processData(json); //create an attributes array
        attributes2 = processData_P(json);
        minValue = calcStats(json); //calculate minimum data value
    
        //lineLayers.All_Line = all_line;
        createSequenceControls(attributes, attributes2);
        createLegend(attributes);

        createLineLayer("data/line/bl_line.geojson","Blue Line")
        createLineLayer("data/line/br_line.geojson","Brown Line")
        createLineLayer("data/line/g_line.geojson","Green Line")
        createLineLayer("data/line/o_line.geojson","Orange Line")
        createLineLayer("data/line/r_line.geojson","Red Line")
        createLineLayer("data/line/y_line.geojson","Yellow Line", true)
    });
};

function createLineLayer(dataSource, layerName, control = false){
    fetch(dataSource)  
    .then(function(response){
        return response.json();
    })
    .then(function(json){
        var attributes = processData(json); //create an attributes array
        var layer = L.geoJson(json, {
            pointToLayer: function(feature, latlng){
                return pointToLayer(feature, latlng, attributes, attributes2);
            }
        }).addTo(map);
        lineLayers[layerName] = layer;

        if (control){
            layerControl();
        };

    })
};

function layerControl(){
    L.control.layers(baseMaps, lineLayers, {
      collapsed: false
    }).addTo(map);

    document.querySelectorAll(".leaflet-control-layers-selector").forEach(function(element){
        element.addEventListener("click", function(){
            var index = document.querySelector('.range-slider').value;
            updatePropSymbols(attributes[index])
        })
    })
    
}

// Import GeoJSON data
function getRoute(){
    fetch("data/MRT_TPE_Routes_Modified.geojson")  //load the data
        .then(function(response){
            return response.json();
        })
        .then(function(json){
            L.geoJson(json).addTo(map);
        })
};

function processData(data){
    var attributes = [];    //empty array to hold attributes
    var properties = data.features[0].properties;       //properties of the first feature in the dataset

    //push each attribute name into attributes array
    for (var attribute in properties){
        //only take 4-digit year values in attributes
        if (attribute.indexOf("yr") > -1){
            attributes.push(attribute);
        };
    };
    return attributes;
};

function processData_P(data){
    var attributes2 = [];   //empty array to hold attributes
    var properties = data.features[0].properties;       //properties of the first feature in the dataset

    //push each attribute name into attributes array
    for (var attribute in properties){
        //only take 4-digit year values in attributes
        if (attribute.indexOf("chgP") > -1){
            attributes2.push(attribute);
        };
    };
    return attributes2;
};

function calcStats(data){
    //create empty array to store all data values
    var allValues = [];
    //loop through each station
    for(var station of data.features){
        //loop through each year
        for(var year = 2015; year <= 2022; year+=1){
            //get ridership for current year
            var value = station.properties["yr"+ String(year)];
            //add value to array
            if (value != 0){
            allValues.push(value);
            }
        }
    };
    //get min, max, mean stats for our array
    dataStats.min = Math.min(...allValues);
    dataStats.max = Math.max(...allValues);
    
    //calculate meanValue
    var sum = allValues.reduce(function(a, b){return a+b;});
    dataStats.mean = sum/ allValues.length;
    
    //get minimum value of our array
    var minValue = Math.min(...allValues)
    return minValue;
};


function pointToLayer(feature, latlng, attributes, attributes2){
    //Determine which attribute to visualize with proportional symbols
    var attribute = attributes[0];
    var attribute2 = attributes2[0];
    //create marker options
    var options = {
        fillColor: "#ff7800",
        color: "#000",
        weight: 1,
        opacity: 1,
        fillOpacity: 0.8,
        pane:"markerPane"
    };

    var attValue = Number(feature.properties[attribute]);   //For each feature, determine its value for the selected attribute
    options.radius = calcPropRadius(attValue);  //Give each feature's circle marker a radius based on its attribute value

    //create circle marker layer
    var layer = L.circleMarker(latlng, options);
    //build popup content string
    var popupContent = createPopupContent(feature.properties, attribute, attribute2)

    //bind the popup to the circle marker
    layer.bindPopup(popupContent, {
        offset: new L.Point(0,-options.radius) 
    });
    return layer;   //return the circle marker to the L.geoJson pointToLayer option
};

//calculate the radius of each proportional symbol
function calcPropRadius(attValue) {
    //constant factor adjusts symbol sizes evenly
    var minRadius = 3;
    //Flannery Apperance Compensation formula
    var radius = 1.0083 * Math.pow(attValue/minValue,0.5715) * minRadius
    return radius;
};

function createLegend(attributes){
    var LegendControl = L.Control.extend({
        options: {
            position: 'bottomright'
        },

        onAdd: function () {
            // create the control container with a particular class name
            var container = L.DomUtil.create('div', 'legend-control-container');

            

            //PUT YOUR SCRIPT TO CREATE THE TEMPORAL LEGEND HERE
            container.innerHTML = '<p class="temporalLegend">Ridership in <span class="year">2015</span></p>';
            //Step 1: start attribute legend svg string
            var svg = '<svg id="attribute-legend" width="200px" height="150px">';
            //array of circle names to base loop on
            var circles = ["max", "mean", "min"];

            //Step 2: loop to add each circle and text to svg string
            for (var i=0; i<circles.length; i++){
                
                //Step 3: assign the r and cy attributes  
                var radius = calcPropRadius(dataStats[circles[i]]);  
                var cy = 130 - radius;  
                //circle string
                svg += '<circle class="legend-circle" id="' + 
                circles[i] + '" r="' + radius + '"cy="' + cy + '" fill="#F47821" fill-opacity="0.8" stroke="#000000" cx="70"/>'; 
                
                //evenly space out labels            
                var textY = i * 40 + 40;            
                //text string            
                svg += '<text id="' + circles[i] + '-text" x="140" y="' + textY + '">' + Math.round(dataStats[circles[i]]*100)/100+ '</text>';

            };
            //close svg string
            svg += "</svg>";
            
            //add attribute legend svg to container
            container.insertAdjacentHTML('beforeend',svg);
            // container.innerHTML += svg;

            return container;
        }
    });
    // var legend = new LegendControl();
    // legend.addTo(map)
    map.addControl(new LegendControl());
};

// create UI control
function createSequenceControls(attributes, attributes2){
    var SequenceControl = L.Control.extend({
        options: {
            position: 'bottomleft'
        },

        onAdd: function () {
            // create the control container div with a particular class name
            var container = L.DomUtil.create('div', 'sequence-control-container');
            
            // ... initialize other DOM elements
            //create range input element (slider)
            container.insertAdjacentHTML('beforeend', '<p class="slider-label">Ridership in: <span class="slider-year">2015</span></p>')
            container.insertAdjacentHTML('beforeend', '<input class="range-slider" type="range">')
            container.insertAdjacentHTML('beforeend','<button class="step" id="reverse" title="Reverse"><img src="img/left.png"></button>');
            container.insertAdjacentHTML('beforeend','<button class="step" id="forward" title="Forward"><img src="img/right.png"></button>');

            //disable any mouse event listeners for the container
            L.DomEvent.disableClickPropagation(container);

            return container;
        }
    });

    map.addControl(new SequenceControl());    // add listeners after adding control}

    //set slider attributes
    document.querySelector(".range-slider").max = 7;
    document.querySelector(".range-slider").min = 0;
    document.querySelector(".range-slider").value = 0;
    document.querySelector(".range-slider").step = 1;

    //Step 5: click listener for buttons
    document.querySelectorAll('.step').forEach(function(step){
        step.addEventListener("click", function(){
            //sequence
            var index = document.querySelector('.range-slider').value;

            //Step 6: increment or decrement depending on button clicked
            if (step.id == 'forward'){
                index++;
                //Step 7: if past the last attribute, wrap around to first attribute
                index = index > 7 ? 0 : index;
            } else if (step.id == 'reverse'){
                index--;
                //Step 7: if past the first attribute, wrap around to last attribute
                index = index < 0 ? 7 : index;
            };
            //Step 8: update slider
            document.querySelector('.range-slider').value = index;
            //Step 9: pass new attribute to update symbols
            updatePropSymbols(attributes[index], attributes2[index]);
        })
    })
    //Step 5: input listener for slider
    document.querySelector('.range-slider').addEventListener('input', function(){            
        //Step 6: get the new index value
        var index = this.value;
        //Step 9: pass new attribute to update symbols
        updatePropSymbols(attributes[index], attributes2[index]);
    });
};

//Step 10: Resize proportional symbols according to new attribute values
function updatePropSymbols(attribute, attribute2){
    var year = attribute.slice(-4);
    //update temporal legend
    document.querySelector("span.year").innerHTML = year;
    document.querySelector("span.slider-year").innerHTML = year;


    map.eachLayer(function(layer){
        if (layer.feature && layer.feature.geometry.type == "Point"){
            //update the layer style and popup
            var props = layer.feature.properties;   //access feature properties

            //update each feature's radius based on new attribute values
            var radius = calcPropRadius(props[attribute]);
            layer.setRadius(radius);
            var popupContent = createPopupContent(props, attribute, attribute2)

            //update popup content            
            popup = layer.getPopup();            
            popup.setContent(popupContent).update();
        }
    });
};

function createPopupContent(properties, attribute, attribute2){
    //add StationName and formatted attribute (ridership data) to popup content string
    var popupContent = "<p><b>StationName:</b> " + properties.stationName + "</p>";
    var lat = parseFloat((properties.latitude).toFixed(5)).toString()
    let lon = parseFloat((properties.longitude).toFixed(5)).toString()
    var year = attribute.slice(-4);
    popupContent +="<p><b>Lat, Lng: </b>"+ lat +", " + lon + "</p>";
    popupContent += "<p><b>Year: </b>" + year  + "</p>";
    if (properties[attribute] == 0){
        popupContent += "(This station is not yet in operation)"
    } else{
    popupContent += "<p><b>Ridership: </b>" + properties[attribute] + "</p>";
    popupContent += "<p><b>Ridership Change Percentage: </b>" + properties[attribute2] + "</p>";
    };
    return popupContent;
};

document.addEventListener('DOMContentLoaded',createMap)
document.addEventListener('DOMContentLoaded',getRoute)

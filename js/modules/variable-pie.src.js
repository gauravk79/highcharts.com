/**
 *
 * Variable Pie module for Highcharts
 *
 * (c) 2010-2017 Grzegorz Blachliński
 *
 * License: www.highcharts.com/license
 */

'use strict';
import H from '../parts/Globals.js';
import '../parts/Utilities.js';
import '../parts/Options.js';

var pick = H.pick,
	each = H.each,
	grep = H.grep,
	arrayMin = H.arrayMin,
	arrayMax = H.arrayMax,
	seriesType = H.seriesType,
	pieProto = H.seriesTypes.pie.prototype;

/**
 * The variablepie series type.
 *
 * @constructor seriesTypes.variablepie
 * @augments seriesTypes.pie
 */

seriesType('variablepie', 'pie',
	/**
	 * A variable pie series is a two dimensional series type, where each point renders an Y and Z value. 
	 * Each point is drawn as a pie slice where the size (arc) of the slice relates to the Y value and the radius of pie slice relates to the Z value.
	 * Requires highcharts-more.js.
	 * 
	 * @extends {plotOptions.pie}
	 * @product highcharts
	 * @sample {highcharts} highcharts/demo/variablepie/ Variable-Radius Pie graph
	 * @since 6.0.0
	 * @optionparent plotOptions.variablepie
	 */
	{
		/**
		 * The minimum size of points' radius related to chart's plotArea.
		 *
		 * @type {String|Number}
		 * @since 6.0.0
		 * @default 10%
		 * @product highcharts
		 */
		minPointSize: '10%',
		/**
		 * The maximum size of points' radius related to chart's plotArea.
		 *
		 * @type {String|Number}
		 * @since 6.0.0
		 * @default 100%
		 * @product highcharts
		 */
		maxPointSize: '100%',
		/**
		 * The minimum possible z value for point's radius calculation. 
		 * If point's Z value is smaller than zMin, slice will be drawn according to zMin value.
		 *
		 * @type {Number}
		 * @since 6.0.0
		 * @default undefined
		 * @product highcharts
		 */
		zMin: undefined,
		/**
		 * The maximum possible z value for point's radius calculation. 
		 * If point's Z value is bigger than zMax, slice will be drawn according to zMax value.
		 *
		 * @type {Number}
		 * @since 6.0.0
		 * @default undefined
		 * @product highcharts
		 */
		zMax: undefined,
		/**
		 * Whether the pie slice's value should be represented by the area or the radius of the slice. 
		 * The default, area, corresponds best to the human perception of the size of each pie slice.
		 *
		 * @type {String}
		 * @since 6.0.0
		 * @default area
		 * @product highcharts
		 */
		sizeBy: 'area',

		/**
		 * A configuration object for the tooltip rendering of each single series.
		 * Properties are inherited from tooltip, but only the following properties can be defined on a series level.
		 *
		 * @type {String}
		 * @default '<span style="color:{point.color}">\u25CF</span><b>
		 * {series.name}</b><br/>'
		 * @product highcharts
		 * @apioption plotOptions.variablepie.tooltip.pointFormat
		 */
		tooltip: {
			pointFormat: '<span style="color:{point.color}">\u25CF</span><b>{series.name}</b><br/>' + 
			'Value: {point.y}<br/>Size: {point.z}<br/>'
		}
	}, {
		pointArrayMap: ['y', 'z'],
		parallelArrays: ['x', 'y', 'z'],

		/*
		 * It is needed to null series.center on chart redraw. Probably good idea will be to add this option in directly in pie series.
		 */
		redraw: function () {
			this.center = null;
			pieProto.redraw.call(this, arguments);
		},

		/*
		 * For arrayMin and arrayMax calculations array shouldn't have null/undefined/string values. In this case it is needed to check if points Z value is a Number.
		 */
		zValEval: function (zVal) {
			if (typeof zVal === 'number' && !isNaN(zVal)) {
				return true;
			}
			return null;
		},

		/*
		 * Before standard translate method for pie chart it is needed to calculate min/max radius of each pie slice based on its Z value.
		 */
		calculateExtremes: function () {
			var series = this,
				chart = series.chart,
				seriesOptions = series.options,
				slicingRoom = 2 * (seriesOptions.slicedOffset || 0),
				zMin,
				zMax,
				zData = series.zData,
				smallestSize = Math.min(chart.plotWidth, chart.plotHeight) - slicingRoom,
				extremes = {}, // Min and max size of pie slice.
				positions = series.center || series.getCenter(); // In pie charts size of a pie is changed to make space for dataLabels, then series.center is changing.

			each(['minPointSize', 'maxPointSize'], function (prop) {
				var length = seriesOptions[prop],
					isPercent = /%$/.test(length);
				length = parseInt(length, 10);
				extremes[prop] = isPercent ?
					smallestSize * length / 100 :
					length * 2; // Because it should be radius, not diameter.
			});

			series.minPxSize = positions[3] + extremes.minPointSize;
			series.maxPxSize = Math.max(Math.min(positions[2], extremes.maxPointSize), positions[3] + extremes.minPointSize);

			if (zData.length) {
				zMin = pick(seriesOptions.zMin, arrayMin(grep(zData, series.zValEval)));
				zMax = pick(seriesOptions.zMax, arrayMax(grep(zData, series.zValEval)));
				this.getRadii(zMin, zMax, series.minPxSize, series.maxPxSize);
			}
		},

		/*
		 * Finding radius of series points based on their Z value and min/max Z value for all series
		 * zMin - min threshold for Z value. If point's Z value is smaller that zMin, point will have the smallest possible radius.
		 * zMax - max threshold for Z value. If point's Z value is bigger that zMax, point will have the biggest possible radius.
		 * minSize - minimal pixel size possible for radius
		 * maxSize - minimal pixel size possible for radius
		 */
		getRadii: function (zMin, zMax, minSize, maxSize) {
			var i = 0,
				pos,
				zData = this.zData,
				len = zData.length,
				radii = [],
				options = this.options,
				sizeByArea = options.sizeBy !== 'radius',
				zRange = zMax - zMin,
				value,
				radius;


			// Calculate radius for all pie slice's based on their Z values
			for (i; i < len; i++) {

				value = this.zValEval(zData[i]) ? zData[i] : zMin; // if zData[i] is null/undefined/string we need to take zMin for smallest radius.

				if (value <= zMin) {
					radius = minSize / 2;
				} else if (value >= zMax) {
					radius = maxSize / 2;
				} else {
					// Relative size, a number between 0 and 1
					pos = zRange > 0 ? (value - zMin) / zRange : 0.5;

					if (sizeByArea) {
						pos = Math.sqrt(pos);
					}

					radius = Math.ceil(minSize + pos * (maxSize - minSize)) / 2;
				}
				radii.push(radius);
			}
			this.radii = radii;
		},


		/**
		 * Extend tranlate by updating radius for each pie slice instead of using one global radius.
		 */
		translate: function (positions) {

			this.generatePoints();

			var series = this,
				cumulative = 0,
				precision = 1000, // issue #172
				options = series.options,
				slicedOffset = options.slicedOffset,
				connectorOffset = slicedOffset + (options.borderWidth || 0),
				finalConnectorOffset,
				start,
				end,
				angle,
				startAngle = options.startAngle || 0,
				startAngleRad = series.startAngleRad = Math.PI / 180 * (startAngle - 90),
				endAngleRad = series.endAngleRad = Math.PI / 180 * ((pick(options.endAngle, startAngle + 360)) - 90),
				circ = endAngleRad - startAngleRad, //2 * Math.PI,
				points = series.points,
				radiusX, // the x component of the radius vector for a given point
				radiusY,
				labelDistance = options.dataLabels.distance,
				ignoreHiddenPoint = options.ignoreHiddenPoint,
				i,
				len = points.length,
				point,
				pointRadii;


			// Use calculateExtremes to get series.radii array.
			series.calculateExtremes();

			// Get positions - either an integer or a percentage string must be given.
			// If positions are passed as a parameter, we're in a recursive loop for adjusting
			// space for data labels.
			if (!positions) {
				series.center = positions = series.getCenter();
			}

			// Utility for getting the x value from a given y, used for anticollision
			// logic in data labels.
			// Added point for using specific points' label distance.
			series.getX = function (y, left, point) {
				angle = Math.asin(Math.min((y - positions[1]) / (positions[2] / 2 + point.labelDistance), 1));
				return positions[0] +
					(left ? -1 : 1) *
					(Math.cos(angle) * (positions[2] / 2 + point.labelDistance));
			};

			// Calculate the geometry for each point
			for (i = 0; i < len; i++) {

				point = points[i];
				pointRadii = series.radii[i];

				// Used for distance calculation for specific point.
				point.labelDistance = pick(
					point.options.dataLabels && point.options.dataLabels.distance,
					labelDistance
				);

				// Saved for later dataLabels distance calculation.
				series.maxLabelDistance = Math.max(series.maxLabelDistance || 0, point.labelDistance);

				// set start and end angle
				start = startAngleRad + (cumulative * circ);
				if (!ignoreHiddenPoint || point.visible) {
					cumulative += point.percentage / 100;
				}
				end = startAngleRad + (cumulative * circ);

				// set the shape
				point.shapeType = 'arc';
				point.shapeArgs = {
					x: positions[0],
					y: positions[1],
					r: pointRadii,
					innerR: positions[3] / 2,
					start: Math.round(start * precision) / precision,
					end: Math.round(end * precision) / precision
				};

				// The angle must stay within -90 and 270 (#2645)
				angle = (end + start) / 2;
				if (angle > 1.5 * Math.PI) {
					angle -= 2 * Math.PI;
				} else if (angle < -Math.PI / 2) {
					angle += 2 * Math.PI;
				}

				// Center for the sliced out slice
				point.slicedTranslation = {
					translateX: Math.round(Math.cos(angle) * slicedOffset),
					translateY: Math.round(Math.sin(angle) * slicedOffset)
				};

				// set the anchor point for tooltips
				radiusX = Math.cos(angle) * positions[2] / 2;
				radiusY = Math.sin(angle) * positions[2] / 2;
				point.tooltipPos = [
					positions[0] + radiusX * 0.7,
					positions[1] + radiusY * 0.7
				];

				point.half = angle < -Math.PI / 2 || angle > Math.PI / 2 ? 1 : 0;
				point.angle = angle;

				// Set the anchor point for data labels. Use point.labelDistance 
				// instead of labelDistance // #1174
				// finalConnectorOffset - not override connectorOffset value.
				finalConnectorOffset = Math.min(connectorOffset, point.labelDistance / 5); // #1678
				point.labelPos = [
					positions[0] + radiusX + Math.cos(angle) * point.labelDistance, // first break of connector
					positions[1] + radiusY + Math.sin(angle) * point.labelDistance, // a/a
					positions[0] + Math.cos(angle) * pointRadii + Math.cos(angle) * finalConnectorOffset, // second break, right outside pie
					positions[1] + Math.sin(angle) * pointRadii + Math.sin(angle) * finalConnectorOffset, // a/a
					positions[0] + Math.cos(angle) * pointRadii, // landing point for connector
					positions[1] + Math.sin(angle) * pointRadii, // a/a
					point.labelDistance < 0 ? // alignment
					'center' :
					point.half ? 'right' : 'left', // alignment
					angle // center angle
				];
			}
		}
	}
);


/**
 * A `variablepie` series. If the [type](#series.variablepie.type) option is not specified,
 * it is inherited from [chart.type](#chart.type).
 * 
 * For options that apply to multiple series, it is recommended to add
 * them to the [plotOptions.series](#plotOptions.series) options structure.
 * To apply to all series of this specific type, apply it to [plotOptions.
 * variablepie](#plotOptions.variablepie).
 * 
 * @type {Object}
 * @extends series,plotOptions.variablepie
 * @excluding dataParser,dataURL,stack,xAxis,yAxis
 * @product highcharts
 * @apioption series.variablepie
 */

/**
 * An array of data points for the series. For the `variablepie` series type,
 * points can be given in the following ways:
 * 
 * 1.  An array of arrays with 2 values. In this case, the numerical values
 * will be interpreted as `y, z` options. Example:
 * 
 *  ```js
 *  data: [
 *      [40, 75],
 *      [50, 50],
 *      [60, 40]
 *  ] 
 *  ```
 * 
 * 2.  An array of objects with named values. The objects are point
 * configuration objects as seen below. If the total number of data
 * points exceeds the series' [turboThreshold](#series.variablepie.turboThreshold),
 * this option is not available.
 * 
 *  ```js
 *  data: [{
 *      y: 1,
 *      z: 4,
 *      name: "Point2",
 *      color: "#00FF00"
 *   }, {
 *      y: 7,
 *      z: 10,
 *      name: "Point1",
 *      color: "#FF00FF"
 *   }]
 *  ```
 * 
 * @type {Array<Object|Number>}
 * @extends series.line.data
 * @excluding marker,x
 * @sample {highcharts} highcharts/chart/reflow-true/ Numerical values
 * @sample {highcharts} highcharts/series/data-array-of-arrays/ Arrays of numeric x and y
 * @sample {highcharts} highcharts/series/data-array-of-arrays-datetime/ Arrays of datetime x and y
 * @sample {highcharts} highcharts/series/data-array-of-name-value/ Arrays of point.name and y
 * @sample {highcharts} highcharts/series/data-array-of-objects/ Config objects
 * @product highcharts
 * @apioption series.variablepie.data
 */

/**
 * The sequential index of the data point in the legend.
 * 
 * @type {Number}
 * @product highcharts
 * @apioption series.variablepie.data.legendIndex
 */

/**
 * Whether to display a slice offset from the center.
 * 
 * @type {Boolean}
 * @sample {highcharts} highcharts/point/sliced/ One sliced point
 * @product highcharts
 * @apioption series.variablepie.data.sliced
 */

/**
 * Fires when the checkbox next to the point name in the legend is clicked.
 * One parameter, event, is passed to the function. The state of the
 * checkbox is found by event.checked. The checked item is found by
 * event.item. Return false to prevent the default action which is to
 * toggle the select state of the series.
 * 
 * @type {Function}
 * @context Point
 * @sample {highcharts} highcharts/plotoptions/series-events-checkboxclick/
 *         Alert checkbox status
 * @since 1.2.0
 * @product highcharts
 * @apioption plotOptions.variablepie.events.checkboxClick
 */

/**
 * Not applicable to variable-pies, as the legend item is per point. See point.
 * events.
 * 
 * @type {Function}
 * @since 1.2.0
 * @product highcharts
 * @apioption plotOptions.variablepie.events.legendItemClick
 */

/**
 * Fires when the legend item belonging to the variablepie point (slice) is
 * clicked. The `this` keyword refers to the point itself. One parameter,
 * `event`, is passed to the function, containing common event information. The
 * default action is to toggle the visibility of the point. This can be
 * prevented by calling `event.preventDefault()`.
 * 
 * @type {Function}
 * @sample {highcharts} highcharts/plotoptions/pie-point-events-legenditemclick/
 *         Confirm toggle visibility
 * @since 1.2.0
 * @product highcharts
 * @apioption plotOptions.variablepie.point.events.legendItemClick
 */

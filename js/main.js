const NICE_FACTOR = 0.90;
const width = window.innerHeight * NICE_FACTOR;
const height = window.innerHeight * NICE_FACTOR;
const mappedAreaSize = 1024*5;

const BRIDGE_UNIT = 128;
const fake = {
  xGen: d3.randomUniform(-mappedAreaSize/2, mappedAreaSize/2),
  // yGen: d3.randomNormal(0, 1000),
  zGen: d3.randomUniform(-mappedAreaSize/2, mappedAreaSize/2),
  fakeGen: null
};

const centerPointFromTranslate = function() {
  if (d3.event && d3.event.translate && d3.event.scale) {
    const [tX, tY] = d3.event.translate;
    const scale = d3.event.scale;
    const centerX = (2*tX - width)/(2*scale)
    const centerY = (2*tY - height)/(2*scale)
    return [centerX, centerY]
  }

  return [0,0];
}

const lineStyler = function (d) {
  if (d === 0) {
    return 'stroke-width:8px;';
  } else if (d % (BRIDGE_UNIT*8) === 0) {
    return 'stroke-width:4px;';
  }
  return 'stroke-width:1px;'
};

const drawCircles = function(container, circleSize) {
  return container.append('g')
    .selectAll('circle')
    .data(data)
    .enter()
    .append('circle')
    .attr('r', circleSize)
    .attr('cx', (d) => d[0])
    .attr('cy', (d) => d[1]);
}



const _nextSpiralPoint = function([x, y], step) {
  let newX, newY;
  newX = (y > 0 && x >= -y)
    ? x + step
    : (y < 0 && x <= -y)
      ? x - step
      : x;
  newY = x <= y && x < 0
    ? y + step
    : x >= y && x > 0
      ? y - step
      : y;
  return [newX, newY];
};

const data2 = [[BRIDGE_UNIT, BRIDGE_UNIT]]
for (let i = 0; i < 200; i++) {
  data2.push(_nextSpiralPoint(data2[data2.length - 1], BRIDGE_UNIT))
}
const data3 = d3
  .range(35)
  .map(() => {
    return [
      Math.floor(fake.xGen()/BRIDGE_UNIT)*BRIDGE_UNIT,
      Math.floor(fake.zGen()/BRIDGE_UNIT)*BRIDGE_UNIT
    ];
  });
const data = data3;

const zoom = d3.behavior
  .zoom()
  .scaleExtent([1./60, 10])
  .on("zoom", zoomed);

const svg = d3.select(".mapContainer").append("svg")
  .attr("width", width)
  .attr("height", height)
  .append("g")
  .call(zoom);
// Viewing port
svg.append("rect")
  .attr('class', 'viewing-rect')
  .attr("pointer-events", "all")
  .attr("width", width)
  .attr("height", height);

const mapBackground = svg.append('g');
const towerLevelOnes = svg.append('g').attr('class', 'scaled');
const towerLevelTwos = svg.append('g');

mapBackground.append("rect")
  .attr('class', 'map-color')
  .attr("pointer-events", "all")
  .attr("x", 0 - mappedAreaSize/2)
  .attr("y", 0 - mappedAreaSize/2)
  .attr("width", mappedAreaSize)
  .attr("height", mappedAreaSize);


const circle = drawCircles(towerLevelTwos, 20);

drawCircles(towerLevelOnes, 32);




towerLevelTwos.append('g')
  .attr("class", "x axis")
  .selectAll('line')
  .data(d3.range(-mappedAreaSize/2, mappedAreaSize/2, BRIDGE_UNIT))
  .enter()
  .append('line')
  .attr('x1', function(d) {return d;})
  .attr('y1', function(d) {return -mappedAreaSize/2;})
  .attr('x2', function(d) {return d;})
  .attr('y2', function(d) {return mappedAreaSize/2;})
  .attr('style', lineStyler);

towerLevelTwos.append('g')
  .attr("class", "y axis")
  .selectAll('line')
  .data(d3.range(-mappedAreaSize/2, mappedAreaSize/2, BRIDGE_UNIT))
  .enter()
  .append('line')
  .attr('y1', function(d) {return d;})
  .attr('x1', function(d) {return -mappedAreaSize/2;})
  .attr('y2', function(d) {return d;})
  .attr('x2', function(d) {return mappedAreaSize/2;})
  .attr('style', lineStyler);



function zoomed() {
  // That's the regular zoom/scale
  const translateString = "translate(" + d3.event.translate + ")";
  const scaleString = "scale(" + d3.event.scale + ")";
  mapBackground.attr("transform", translateString + scaleString);
  towerLevelTwos.attr("transform", translateString + scaleString);

  // That is the modified scale/transform combination that creates the illusion
  // of the tower points leaning away from center of the map
  const translateReduced = [d3.event.translate[0] - width/2, d3.event.translate[1] - height/2];
  const centralPoint = [width/2, height/2];
  const scaleFactor = 1 - 0.02*d3.event.scale;
  const scale2String = "scale(" + scaleFactor + ")";
  const translateReducedString = "translate(" + translateReduced + ")";
  const translate2String = "translate(" + centralPoint + ")";
  towerLevelOnes.attr("transform", translate2String + scale2String + translateReducedString + scaleString)
}

function goToCoordinates (x, y) {
  const translate = [width/2, height/2];
  translate[0] += x;
  translate[1] += y;
  zoom.translate(translate);
  zoom.event(towerLevelTwos);
}


const roadBuilder = (function buildHighwayCalculator(hub, targetLocations, mapSize) {
  const _hub = [...hub];
  const _targetLocations = targetLocations;
  const _currentBridgePoints = [];
  let _bridgeNeighbouringPoints = [{
    pt: _hub, // The 1st bridge point will be the hub itself
    distances: [], // Each bridge pt knows the distances from it to every targetLocation
    positiveDifferencesSum: 0,
    originPoint: null,
    price: 0
  }];
  // at index i holds the best distance from any existing bridge pt to location i.
  // initialized with a number guaranteed to be larger than a distance on the map
  const _bestDistances = targetLocations.map(() => {return {amount: mapSize*2, bridgePoint: 0};});

  const _distance = function (ptA, ptB) {
    return Math.sqrt(Math.pow(ptA[0]-ptB[0],2) + Math.pow(ptA[1]-ptB[1], 2));
  }

  const _calculateNeighbourPointDistancesToLocations = function() {
    _bridgeNeighbouringPoints.forEach(potentialBridgePoint => {
      // This prevents recalculation if no target locations have been added
      const resumeIndex = potentialBridgePoint.distances.length;
      for (let index = resumeIndex; index < _targetLocations.length; index++) {
        potentialBridgePoint.distances.push(_distance(_targetLocations[index], potentialBridgePoint.pt))
      }
    });
  }

  const _evaluateNeighbours = function() {
    _bridgeNeighbouringPoints.forEach(point => {
      point.positiveDifferencesSum = point.distances
        .map((dist, index) => {
          return {index: index, amount: (_bestDistances[index].amount - dist)/dist};
        })  // calculate difference with best
        .filter(difference => {
          let originApplies = true;
          if (point.originPoint !== null) {
            const bestPointIndex = _bestDistances[difference.index].bridgePoint;
            const bestPointKey = _currentBridgePoints[bestPointIndex].pt.join('_');
            originApplies = bestPointKey === point.originPoint.join('_');
          }
          return difference.amount > 0 && originApplies;
        }) // leave just the positive ones
        .reduce((a, b) => {
          return {amount: a.amount + b.amount};
        }, {amount:0.}).amount;
    })
  }

  const _removeZeroSumNeighbours = function () {
    _bridgeNeighbouringPoints = _bridgeNeighbouringPoints.filter(bnp => bnp.positiveDifferencesSum > 0);
  }

  const _updateEvaluationWithDistanceFromHubPenalty = function () {
    _bridgeNeighbouringPoints.forEach(bnp => bnp.positiveDifferencesSum -= point.price * BRIDGE_UNIT);
  }

  const _removeNeighboursNotPointingToABestie = function() {
    if (_currentBridgePoints.length === 0) {
      return;
    }
    const validBridgePoints = {};
    _bestDistances.forEach(bd => {
      const key =_currentBridgePoints[bd.bridgePoint].pt.join('_');
      validBridgePoints[key] = true;
    });
    _bridgeNeighbouringPoints = _bridgeNeighbouringPoints
      .filter(bnp => bnp.originPoint === null || validBridgePoints.hasOwnProperty(bnp.originPoint.join('_')))
  }

  const _promoteBestNeighbourToBridgePoint = function () {
    let bestIndexes = [];
    let bestSum = 0;
    _bridgeNeighbouringPoints.forEach((pt, nIndex) => {
      if (pt.positiveDifferencesSum > bestSum) {
        bestIndexes = [nIndex];
        bestSum = pt.positiveDifferencesSum;
      } else if (pt.positiveDifferencesSum === bestSum) {
        bestIndexes.push(nIndex);
      }
    });
    if (bestIndexes.length === 0) {
      return;
    }
    // This is where I specify a preference for horizontal/diagonal lines from existing points to make sure generated paths are not wobbly
    bestIndexes.sort((i1, i2) => {
      const pt1 = _bridgeNeighbouringPoints[i1].pt;
      const orig1 = _bridgeNeighbouringPoints[i1].originPoint;
      const dist1 = _distance(pt1, orig1);
      const pt2 = _bridgeNeighbouringPoints[i2].pt;
      const orig2 = _bridgeNeighbouringPoints[i2].originPoint;
      const dist2 = _distance(pt2, orig2);
      return dist1 - dist2;
    });
    const bestIndex = bestIndexes[0];

    const bridgePointCandidate = _bridgeNeighbouringPoints.splice(bestIndex, 1)[0];
    const newIndex = _currentBridgePoints.length;
    _currentBridgePoints.push(bridgePointCandidate);
    // Update bestDistances
    let reachedLocation = false;
    bridgePointCandidate.distances.forEach((dist, index) => {
      if (_bestDistances[index].amount > dist) {
        if (dist < BRIDGE_UNIT) {
          reachedLocation = true;
        }
        _bestDistances[index].amount = dist;
        _bestDistances[index].bridgePoint = newIndex;
      }
    });
    if (reachedLocation) {
      bridgePointCandidate.price = 0;
    }
  }

  const _identifyNewNeighbours = function () {
    const lastAddedBridgePoint = _currentBridgePoints[_currentBridgePoints.length - 1];
    // For simplicity add all 8 points. Any overlaps, duplications and more will get eliminated as the bridge grows.

    for (let xOffset = -1; xOffset <= 1; xOffset++) {
      for (let yOffset = -1; yOffset <= 1; yOffset++) {
        // if (Math.abs(xOffset) === Math.abs(yOffset)) {
        //   continue;
        // }
        _bridgeNeighbouringPoints.push({
          pt: [lastAddedBridgePoint.pt[0] + xOffset*BRIDGE_UNIT, lastAddedBridgePoint.pt[1] + yOffset*BRIDGE_UNIT],
          distances: [],
          positiveDifferencesSum: 0,
          originPoint: [...lastAddedBridgePoint.pt],
          price: lastAddedBridgePoint.price + 1
        });
      }
    }
  }

  // does what _calcNextSegment does, but in 3 steps
  let phase = 0;
  const _nextStep = function() {
    switch (phase) {
      case 0:
        _calculateNeighbourPointDistancesToLocations();
        _evaluateNeighbours();
        _removeZeroSumNeighbours();
        _updateEvaluationWithDistanceFromHubPenalty();
        _removeNeighboursNotPointingToABestie();
        break;
      case 1:
        _promoteBestNeighbourToBridgePoint();
        break;
      case 2:
        _identifyNewNeighbours();
        break;
    }
    phase = (phase + 1)%3;
    return phase;
  }
  const _calcNextSegment = function() {
    const starterCount = _currentBridgePoints.length;
    _calculateNeighbourPointDistancesToLocations();
    _evaluateNeighbours();
    _removeZeroSumNeighbours();
    _removeNeighboursNotPointingToABestie();
    // _leaveOnly
    _promoteBestNeighbourToBridgePoint();
    _identifyNewNeighbours();
    console.log("Bridge length", _currentBridgePoints.length);
    return _currentBridgePoints.length !== starterCount;
  }

  _lastAdded = function () {
    return _currentBridgePoints.length !== 0 ?
      _currentBridgePoints[_currentBridgePoints.length - 1] :
      [0, 0]
  }

  _isDone = function () {
    console.log(_bestDistances);
    return _bestDistances
      .map(bd => bd.amount)
      .filter(amount => amount >= BRIDGE_UNIT)
      .length === 0;
  }
  return {
    next: _calcNextSegment,
    nextStep: _nextStep,
    getLast: _lastAdded,
    done: _isDone,
    getBridgeElements: () => _currentBridgePoints,
    getCandidateElements: () => _bridgeNeighbouringPoints
  }
})([0,0], data, mappedAreaSize);

const bridgeD3 = towerLevelTwos.append('g');
const pointer = towerLevelTwos.append('g');

function d3Render() {

  bridgeD3.attr('class', 'bridge')
    .selectAll('line')
    .data(roadBuilder.getBridgeElements(), d => d.pt.join('_'))
    .enter()
    .append('line')
    .attr('x1', function (d) {return d.pt[0]})
    .attr('y1', function (d) {return d.pt[1]})
    .attr('x2', function (d) {return d.originPoint ? d.originPoint[0] : d.pt[0]})
    .attr('y2', function (d) {return d.originPoint ? d.originPoint[1] : d.pt[1]})
    .append('circle')
    .attr('r', 20)
    .attr('cx', (d) => d[0])
    .attr('cy', (d) => d[1])

  const pointerD3 = pointer.attr('class', 'pointer')
    .selectAll('circle')
    .data([roadBuilder.getLast().pt], (pt) => pt[0] + '-' + pt[1])
  pointerD3
    .enter()
    .append('circle')
    .attr('r', 64)
    .attr('cx', d => d[0])
    .attr('cy', d => d[1])
  pointerD3.exit()
    .remove()
}
function nextStep () {
  roadBuilder.next();
  d3Render();
}
function fitMapOnView () {
  const viewDimension = Math.min(width, height);

  // Feels better when it doesn't fit perfectly
  // but instead there's an outside-of-map strip visible
  zoom.scale(NICE_FACTOR*viewDimension/mappedAreaSize)
  goToCoordinates(0,0);
}
function startBuilding () {
  nextStep();
  if (!roadBuilder.done()) {
    setTimeout(startBuilding, 100)
  } else {
    alert('Road builder done!');
  }
}

(function(window) {

    var start, end;
    console.log('start', start = new Date().getTime());

    var height = window.innerHeight;
    var width = window.innerWidth;

    var visibleSystems = {};
    var showSystem = function(s) {
        if (s.regionId > 10000070) return false;

        visibleSystems[s.id] = s;
        return true;
    };

    var showSolarJump = function(jump) {
        return jump.toRegionId === jump.fromRegionId && visibleSystems[jump.toSolarSystemId] && visibleSystems[jump.fromSolarSystemId];
    };

    var showRegionJump = function(jump) {
        return jump.toRegionId !== jump.fromRegionId && visibleSystems[jump.toSolarSystemId] && visibleSystems[jump.fromSolarSystemId];
    };

    var systems = _(window.systems).filter(showSystem);
    var jumps = _(window.jumps).filter(showSolarJump);
    var regionJumps = _(window.jumps).filter(showRegionJump);

    jumps = _(jumps).map(function(j) {
        var to = visibleSystems[j.toSolarSystemId];
        var from = visibleSystems[j.fromSolarSystemId];

        return {
            to: to,
            from: from
        };
    });

    regionJumps = _(regionJumps).map(function(j) {
        var to = visibleSystems[j.toSolarSystemId];
        var from = visibleSystems[j.fromSolarSystemId];

        return {
            to: to,
            from: from
        };
    });


    var minX = _(systems).min(function(s) { return s.x; }).x;
    var maxX = _(systems).max(function(s) { return s.x; }).x;
    var deltaX = maxX - minX;

    var minZ = _(systems).min(function(s) { return s.z; }).z;
    var maxZ = _(systems).max(function(s) { return s.z; }).z;
    var deltaZ = maxZ - minZ;

    var screenRatio = width / height;
    var mapRatio = deltaX / deltaZ;

    var x = d3.scale.linear()
        .domain([minX, maxX])
        .range([0, (height - 100) * mapRatio]);

    var z = d3.scale.linear()
        .domain([maxZ, minZ])
        .range([0, height - 100]);

    var map = d3.select('svg#map')
        .append('g')
        .attr('transform', 'translate(50, 50)');

    map.selectAll('line')
        .data(regionJumps)
        .enter()
            .append('line')
            .attr('class', 'region')
            .attr('x1', function(d) { return x(d.to.x); })
            .attr('y1', function(d) { return z(d.to.z); })
            .attr('x2', function(d) { return x(d.from.x); })
            .attr('y2', function(d) { return z(d.from.z); });

    map.selectAll('line')
        .data(jumps)
        .enter()
            .append('line')
            .attr('class', 'solar')
            .attr('x1', function(d) { return x(d.to.x); })
            .attr('y1', function(d) { return z(d.to.z); })
            .attr('x2', function(d) { return x(d.from.x); })
            .attr('y2', function(d) { return z(d.from.z); });


    map.selectAll('circle')
        .data(systems)
        .enter()
            .append('circle')
            .attr('cx', function(d) { return x(d.x); })
            .attr('cy', function(d) { return z(d.z); })
            .attr('r', 2);

    console.log('end', end = new Date().getTime());
    console.log('time', end - start);

    console.log('elements', regionJumps.length, jumps.length, systems.length);


})(window);

(function(window) {

    var visibleSystems = {};
    var showSystem = function(s) {
        if (s.regionId > 10000070) return false;
        if (_([10000004, 10000017, 10000019]).contains(s.regionId)) return false;

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
    var midX = minX + deltaX / 2;

    var minZ = _(systems).min(function(s) { return s.z; }).z;
    var maxZ = _(systems).max(function(s) { return s.z; }).z;
    var deltaZ = maxZ - minZ;
    var midZ = minZ + deltaZ / 2;

    var aspectRatio = deltaX / deltaZ;
    var height = 500;
    var width = height * aspectRatio;

    var x = d3.scale.linear()
        .domain([minX, maxX])
        .range([0, height * aspectRatio]);

    var z = d3.scale.linear()
        .domain([maxZ, minZ])
        .range([0, height]);

    var map = d3.select('svg#map')
        .append('g');

    map.append('g').selectAll('line')
        .data(regionJumps)
        .enter()
            .append('line')
            .attr('class', 'region')
            .attr('x1', function(d) { return x(d.to.x); })
            .attr('y1', function(d) { return z(d.to.z); })
            .attr('x2', function(d) { return x(d.from.x); })
            .attr('y2', function(d) { return z(d.from.z); });

    map.append('g').selectAll('line')
        .data(jumps)
        .enter()
            .append('line')
            .attr('class', 'solar')
            .attr('x1', function(d) { return x(d.to.x); })
            .attr('y1', function(d) { return z(d.to.z); })
            .attr('x2', function(d) { return x(d.from.x); })
            .attr('y2', function(d) { return z(d.from.z); });

    var colors = d3.scale.category10();

    var systemTree = new RTree();
    _(systems).each(function(s) {
        var length = 4000000000000;

        var minX = s.x - length;
        var maxX = s.x + length;
        var minZ = s.z - length;
        var maxZ = s.z + length;

        systemTree.insert({
            x: minX,
            y: minZ,
            w: maxX - minX,
            h: maxZ - minZ
        }, s);
    });

    var sh = window.innerHeight;
    var sw = window.innerWidth;

    var zoom = d3.behavior.zoom()
        .scaleExtent([1, 128])
        .translate([sw / 2 - width/2, sh / 2 - height/2])
        .scale(1)
        .on("zoom", zoomed);

    d3.select('svg g')
        .attr('transform', 'translate(' + zoom.translate() + ')scale(' + zoom.scale() + ')');

    d3.select('svg').call(zoom);

    var scale = zoom.scale();

    function zoomed() {
        var eventType;

        if(d3.event) {
            eventType = d3.event.sourceEvent.type;
        }


        console.log('translate', zoom.translate(), 'scale', zoom.scale());


        if (eventType === "dblclick") {
            d3.select('svg g')
                .transition()
                .attr('transform', 'translate(' + zoom.translate()[0] + ', ' + zoom.translate()[1] + ')scale(' + zoom.scale() + ')');
        } else {
            d3.select('svg g')
                .attr('transform', 'translate(' + zoom.translate()[0] + ', ' + zoom.translate()[1] + ')scale(' + zoom.scale() + ')');
        }


        updateMap();
    }

    function updateMap() {
        var currentScale = zoom.scale() | 0;

        if(scale !== currentScale)
        {
            scale = currentScale;
            d3.select('svg g').attr('class', 'zoom' + Math.pow(2, ((Math.log(scale)/Math.log(2)) | 0)));
        }

        var bounds = {
            x: x.invert((0 - zoom.translate()[0]) / zoom.scale()),
            y: z.invert((sh - zoom.translate()[1]) / zoom.scale()),
            w: (x.invert(sw) - x.invert(0)) / zoom.scale(),
            h: (z.invert(0) - z.invert(sh)) / zoom.scale()
        };

        console.log('bounds', bounds);

        if(scale > 8) {

            var ss = map.selectAll('circle')
                .data(systemTree.search(bounds), function(s) {
                    return s.id;
                });

            // ss.attr('r', 0.2)
            //     .style('stroke-width', '0.2')

            ss.enter()
                .append('circle')
                .attr('cx', function(d) { return x(d.x); })
                .attr('cy', function(d) { return z(d.z); })
                .attr('r', .15)
                .style('stroke-width', '0.05')
                .style('stroke', function(d) { return colors(d.regionId); })
                .style('fill', '#FFF');

            ss.exit()
                .remove();

        } else {
            map.selectAll('circle').remove();
        }

        if(scale > 16) {
            var ss = map.selectAll('text')
                .data(systemTree.search(bounds), function(s) {
                    return s.id;
                });

            ss.enter()
                .append('text')
                .attr('x', function(d) { return x(d.x); })
                .attr('y', function(d) { return z(d.z); })
                .attr('dy', '0.175em')
                .attr('dx', .5)
                .style({
                    'font-family': 'helvetica, arial',
                    'font-size': '0.5px'
                })
                .text(function(d) { return d.name; });

            ss.exit()
                .remove();

        } else {
            map.selectAll('text').remove();
        }
    }

    function zoomSystem(systemName) {

        var system = _(systems).find(function(s) { return s.name === systemName; });

        if(!system) return;

        var sh = window.innerHeight;
        var sw = window.innerWidth;

        var height = 13896860379771180;
        var width = height * (sw / sh);

        var scale = (z.invert(0) - z.invert(sh)) / height;

        var transform = {
            scale: scale,
            x: -x(system.x - width / 2) * scale,
            y: sh - z(system.z - height / 2) * scale
        };

        d3.transition().duration(2000).tween("zoom", function() {

            var ix = d3.interpolate(zoom.translate()[0], transform.x),
                iy = d3.interpolate(zoom.translate()[1], transform.y)
                is = d3.interpolate(zoom.scale(), transform.scale);

            return function(t) {
                zoom.translate([ix(t), iy(t)]);
                zoom.scale(is(t));
                zoomed();
            };
        });
    }

    d3.select('#zoom-jita').on('click', function() {
        zoomSystem("Amarr");
    });

})(window);

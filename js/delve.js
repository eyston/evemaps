(function(window) {

    var graph = {
        nodes: systems,
        links: jumps.map(function(j) {
            return {
                source: systems.filter(function(s) { return s.id === j.fromSolarSystemId; })[0],
                target: systems.filter(function(s) { return s.id === j.toSolarSystemId; })[0]
            };
        })
    };

    var width = 960,
        height = 500;

    var force = d3.layout.force()
        .charge(-50)
        .linkDistance(20)
        .gravity(.1)
        .size([width, height]);

    var svg = d3.select("body").append("svg")
        .attr("width", width)
        .attr("height", height);

    force
        .nodes(graph.nodes)
        .links(graph.links)
        .start();

    var link = svg.append('g').selectAll(".link")
            .data(graph.links)
        .enter().append("line")
            .attr("class", "link")
            .style({
                stroke: "#000",
                "stroke-width": "2"
            });

    var pathContainer = svg.append('g').attr("class", "path");
    var path = pathContainer.selectAll("line");

    var node = svg.append('g').selectAll(".node")
            .data(graph.nodes)
        .enter().append("circle")
            .attr("class", "node")
            .attr("r", 5)
            .style({
                fill: "#00F",
                stroke: "#FFF",
                "stroke-width": 2
            })
            .call(force.drag);

    node.append("title")
        .text(function(d) { return d.name; });

    force.on("tick", function() {
        link.attr("x1", function(d) { return d.source.x; })
            .attr("y1", function(d) { return d.source.y; })
            .attr("x2", function(d) { return d.target.x; })
            .attr("y2", function(d) { return d.target.y; });

        node.attr("cx", function(d) { return d.x; })
            .attr("cy", function(d) { return d.y; });

        path.attr("x1", function(d) { return d.source.x; })
            .attr("y1", function(d) { return d.source.y; })
            .attr("x2", function(d) { return d.target.x; })
            .attr("y2", function(d) { return d.target.y; });
    });

    var pathIndex = 0;
    var segments = [];
    var duration = 250;
    var advancePath = function() {
        var p = paths[pathIndex][2];

        if (pathIndex === 0) {
            segments = [];
        }

        if (p.length > 1) {
            var segment = p.slice(-2);
            segments.push({
                source: systems.filter(function(s) { return s.id === segment[0]; })[0],
                target: systems.filter(function(s) { return s.id === segment[1]; })[0]
            });
        }

        path = pathContainer.selectAll("line").data(segments);

        path.enter()
            .append("line")
            .attr("x1", function(d) { return d.source.x; })
            .attr("y1", function(d) { return d.source.y; })
            .attr("x2", function(d) { return d.target.x; })
            .attr("y2", function(d) { return d.target.y; })
            .style({
                stroke: "#F00",
                "stroke-width": "2"
            })
            .transition().duration(duration)
                .style({stroke: "#0F0"});

        path.exit().remove();

        node.style("fill", function(d) {
            if(d.id === 30004712) { return "#F00" };
            return segments.filter(function(s) { return s.target.id === d.id; }).length > 0 ? "#0F0" : "#00F";
        });

        pathIndex = (pathIndex + 1) % paths.length;

        if(pathIndex === 0) {
            setTimeout(advancePath, 5000);
        } else {
            setTimeout(advancePath, duration);
        }
    };

    setTimeout(advancePath, 5000);

})(window);

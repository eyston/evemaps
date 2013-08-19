angular.module('evemaps', []);

angular.module('evemaps').factory('MapsService', ['$window', function($window) {

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

    var linkJump = function(j) {
        var to = visibleSystems[j.toSolarSystemId];
        var from = visibleSystems[j.fromSolarSystemId];

        return {
            to: to,
            from: from
        };
    }

    var systems = _($window.systems).filter(showSystem);
    var jumps = _($window.jumps).chain().filter(showSolarJump).map(linkJump).value();
    var regionJumps = _($window.jumps).chain().filter(showRegionJump).map(linkJump).value();

    return {
        systems: systems,
        jumps: jumps,
        regionJumps: regionJumps
    };

}]);

angular.module('evemaps').directive('evemap', ['$window', 'MapsService', function($window, mapsService) {

    // TODO: figure out which of these functions belong to the SVG renderer and which belong to the data structure

    function _mapBounds(systems) {
        var minX = _(systems).min(function(s) { return s.x; }).x;
        var maxX = _(systems).max(function(s) { return s.x; }).x;

        var minZ = _(systems).min(function(s) { return s.z; }).z;
        var maxZ = _(systems).max(function(s) { return s.z; }).z;

        return {
            x: minX,
            y: minZ,
            w: maxX - minX,
            h: maxZ - minZ
        };
    };

    function translationForPoint(map, scale, point) {
        return [map.screen.w / 2 - map.scale.x(point.x) * scale, map.screen.h / 2 - map.scale.z(point.z) * scale];
    };

    function mapCenter(map) {
        return { x: map.bounds.x + map.bounds.w / 2, z: map.bounds.y + map.bounds.h / 2 };
    };

    function createMap(svg, bounds) {

        var size = 500,
            x = d3.scale.linear()
                .domain([0, bounds.w])
                .range([0, size]),
            z = d3.scale.linear()
                .domain([0, bounds.w])
                .range([0, -size]);

        var zoom = d3.behavior.zoom()
            .scaleExtent([1, 128]);

        svg.call(zoom);

        var map = {
            element: svg.append('g'),
            screen: {
                h: $window.innerHeight,
                w: $window.innerWidth
            },
            bounds: bounds,
            scale: {
                x: x,
                z: z
            },
            zoom: zoom,
            colors: d3.scale.category10()
        };

        // create observables
        map.zooms = new Rx.Subject();
        zoom.on("zoom", function() { map.zooms.onNext(map); });

        map.zooms.subscribe(transformMap);

        // meh ...
        map.zooms
            .select(function(map) {
                return [map, snapToPowerOfTwo(truncate(map.zoom.scale()))];
            })
            .distinctUntilChanged(function(d) {
                return d[1];
            })
            .subscribe(function(d) { scaleMap(d[0], d[1]); });

        return map;
    };

    function truncate(value) {
        return value | 0;
    };

    function snapToPowerOfTwo(value) {
        return Math.pow(2, ((Math.log(value)/Math.log(2)) | 0)) | 0;
    };


    function zoomMap(map, scale, translate) {
        map.zoom.scale(scale);
        map.zoom.translate(translate);

        map.zooms.onNext(map);
    };

    function transformMap(map) {
        map.element.attr('transform', 'translate(' + map.zoom.translate()[0] + ', ' + map.zoom.translate()[1] + ')scale(' + map.zoom.scale() + ')');
    };

    function scaleMap(map, scale) {
        map.element.attr('class', 'zoom' + scale);
    };

    function drawJumps(map, jumps) {
        map.element.append('g').selectAll('line')
            .data(jumps)
            .enter()
                .append('line')
                .attr('class', 'solar')
                .attr('x1', function(d) { return map.scale.x(d.to.x); })
                .attr('y1', function(d) { return map.scale.z(d.to.z); })
                .attr('x2', function(d) { return map.scale.x(d.from.x); })
                .attr('y2', function(d) { return map.scale.z(d.from.z); });
    };

    function drawRegionJumps(map, regionJumps) {
        map.element.append('g').selectAll('line')
            .data(regionJumps)
            .enter()
                .append('line')
                .attr('class', 'region')
                .attr('x1', function(d) { return map.scale.x(d.to.x); })
                .attr('y1', function(d) { return map.scale.z(d.to.z); })
                .attr('x2', function(d) { return map.scale.x(d.from.x); })
                .attr('y2', function(d) { return map.scale.z(d.from.z); });
    };

    function createSystemsRTree(systems) {
        var tree = new RTree();

        _(systems).each(function(s) {
            var length = 4000000000000;

            var minX = s.x - length;
            var maxX = s.x + length;
            var minZ = s.z - length;
            var maxZ = s.z + length;

            tree.insert({
                x: minX,
                y: minZ,
                w: maxX - minX,
                h: maxZ - minZ
            }, s);
        });

        return tree;
    };

    function viewableBounds(map) {
        return {
            x: map.scale.x.invert((0 - map.zoom.translate()[0]) / map.zoom.scale()),
            y: map.scale.z.invert((map.screen.h - map.zoom.translate()[1]) / map.zoom.scale()),
            w: (map.scale.x.invert(map.screen.w) - map.scale.x.invert(0)) / map.zoom.scale(),
            h: (map.scale.z.invert(0) - map.scale.z.invert(map.screen.h)) / map.zoom.scale()
        };
    }

    function drawSystems(map, systems) {
        var ss = map.element.selectAll('circle')
            .data(systems, function(s) {
                return s.id;
            });

        ss.enter()
            .append('circle')
            .attr('cx', function(d) { return map.scale.x(d.x); })
            .attr('cy', function(d) { return map.scale.z(d.z); })
            .attr('r', .15)
            .style('stroke-width', '0.05')
            .style('stroke', function(d) { return map.colors(d.regionId); })
            .style('fill', '#FFF');

        ss.exit()
            .remove();
    };

    function drawSystemLabels(map, systems) {
        var ss = map.element.selectAll('text')
            .data(systems, function(s) {
                return s.id;
            });

        ss.enter()
            .append('text')
            .attr('x', function(d) { return map.scale.x(d.x); })
            .attr('y', function(d) { return map.scale.z(d.z); })
            .attr('dy', '0.175em')
            .attr('dx', .5)
            .style({
                'font-family': 'helvetica, arial',
                'font-size': '0.5px'
            })
            .text(function(d) { return d.name; });

        ss.exit()
            .remove();
    };

    function zoomSystem(map, system) {

        // TOOD:  break this out into a zoomBox thang

        // determines how big the screen should be
        var height = 30000000000000000;
        var width = height * (map.screen.w / map.screen.h);

        var scale = map.scale.x.invert(map.screen.w) / width;
        var translation = translationForPoint(map, scale, system);

        transitionMap(map, scale, translation);
    };

    function transitionMap(map, scale, translation) {
        d3.transition().duration(2000).tween("zoom", function() {

            var ix = d3.interpolate(map.zoom.translate()[0], translation[0]),
                iy = d3.interpolate(map.zoom.translate()[1], translation[1])
                is = d3.interpolate(map.zoom.scale(), scale);

            return function(t) {
                zoomMap(map, is(t), [ix(t), iy(t)]);
            };
        });
    };


    return {
        restrict: 'E',
        replace: true,
        template: '<svg></svg>',
        scope: {
            mode: "="
        },

        link: function(scope, element, attrs) {
            var data = {
                systems: mapsService.systems,
                jumps: mapsService.jumps,
                regionJumps: mapsService.regionJumps
            };

            var map = createMap(d3.select(element[0]), _mapBounds(data.systems));
            drawJumps(map, data.jumps);
            drawRegionJumps(map, data.regionJumps);

            // we want to translate so map is in middle
            var scale = 2,
                centerTranslation = translationForPoint(map, scale, mapCenter(map));

            zoomMap(map, scale, centerTranslation);

            var systemsTree = createSystemsRTree(data.systems);

            map.zooms.subscribe(function(map) {
                var bounds = viewableBounds(map);

                var systems = map.zoom.scale() > 8 ? systemsTree.search(bounds) : [];

                drawSystems(map, systems);
                drawSystemLabels(map, map.zoom.scale() > 16 ? systems : []);
            });


            // TODO: maybe have an init function or something that takes a map to wire shit up
            $($window).bind("resize", function(ev) {
                map.screen = {
                    h: $window.innerHeight,
                    w: $window.innerWidth
                };
            });

            scope.$watch("mode", function(mode) {
                if(!mode) return;

                if(mode.type === "zoom") {
                    zoomSystem(map, mode.target);
                }
            });
        }
    }

}]);

angular.module('evemaps').controller('MapController', ['$scope', 'MapsService', function($scope, mapsService) {

    $scope.systems = [];

    $scope.searchSystems = function(term) {
        if(!term) {
            $scope.systems = [];
        } else {
            $scope.systems =  _(mapsService.systems).filter(function(s) {
                // meh to upper~
                return s.name.toUpperCase().indexOf(term.toUpperCase()) === 0;
            }).slice(0, 10);
        }
    };

    $scope.selectSystem = function(system) {
        $scope.term = system.name;
        $scope.mapMode = {
            type: "zoom",
            target: system
        };
    };

    $scope.randomSystem = function() {
        var system = mapsService.systems[Math.floor(Math.random()*mapsService.systems.length)];

        $scope.term = system.name;
        $scope.mapMode = {
            type: "zoom",
            target: system
        };
    };

}]);

angular.module('evemaps').directive('typeahead', ["$timeout", function($timeout) {
    return {
        restrict: 'E',
        transclude: true,
        replace: true,
        template: '<div><form><input ng-model="term" ng-change="query()" type="text" autocomplete="off" placeholder="example search: Jita" /></form><div ng-transclude></div></div>',
        scope: {
            search: "&",
            select: "&",
            items: "=",
            term: "="
        },
        controller: ["$scope", function($scope) {
            $scope.items = [];
            $scope.hide = false;

            this.activate = function(item) {
                $scope.active = item;
            };

            this.activateNextItem = function() {
                var index = $scope.items.indexOf($scope.active);
                this.activate($scope.items[(index + 1) % $scope.items.length]);
            };

            this.activatePreviousItem = function() {
                var index = $scope.items.indexOf($scope.active);
                this.activate($scope.items[index === 0 ? $scope.items.length - 1 : index - 1]);
            };

            this.isActive = function(item) {
                return $scope.active === item;
            };

            this.selectActive = function() {
                this.select($scope.active);
            };

            this.select = function(item) {
                $scope.hide = true;
                $scope.focused = true;
                $scope.select({item:item});
            };

            $scope.isVisible = function() {
                return !$scope.hide && ($scope.focused || $scope.mousedOver);
            };

            $scope.query = function() {
                $scope.hide = false;
                $scope.search({term:$scope.term});
            }
        }],

        link: function(scope, element, attrs, controller) {

            var $input = element.find('form > input');
            var $list = element.find('> div');

            $input.bind('focus', function() {
                scope.$apply(function() { scope.focused = true; });
            });

            $input.bind('blur', function() {
                scope.$apply(function() { scope.focused = false; });
            });

            $list.bind('mouseover', function() {
                scope.$apply(function() { scope.mousedOver = true; });
            });

            $list.bind('mouseleave', function() {
                scope.$apply(function() { scope.mousedOver = false; });
            });

            $input.bind('keyup', function(e) {
                if (e.keyCode === 9 || e.keyCode === 13) {
                    scope.$apply(function() { controller.selectActive(); });
                }

                if (e.keyCode === 27) {
                    scope.$apply(function() { scope.hide = true; });
                }
            });

            $input.bind('keydown', function(e) {
                if (e.keyCode === 9 || e.keyCode === 13 || e.keyCode === 27) {
                    e.preventDefault();
                };

                if (e.keyCode === 40) {
                    e.preventDefault();
                    scope.$apply(function() { controller.activateNextItem(); });
                }

                if (e.keyCode === 38) {
                    e.preventDefault();
                    scope.$apply(function() { controller.activatePreviousItem(); });
                }
            });

            scope.$watch('items', function(items) {
                controller.activate(items.length ? items[0] : null);
            });

            scope.$watch('focused', function(focused) {
                if (focused) {
                    $timeout(function() { $input.focus(); }, 0, false);
                }
            });

            scope.$watch('isVisible()', function(visible) {
                if (visible) {
                    var pos = $input.position();
                    var height = $input[0].offsetHeight;

                    $list.css({
                        top: pos.top + height,
                        left: pos.left,
                        position: 'absolute',
                        display: 'block'
                    });
                } else {
                    $list.css('display', 'none');
                }
            });
        }
    };
}]);

angular.module('evemaps').directive('typeaheadItem', function() {
    return {
        require: '^typeahead',
        link: function(scope, element, attrs, controller) {

            var item = scope.$eval(attrs.typeaheadItem);

            scope.$watch(function() { return controller.isActive(item); }, function(active) {
                if (active) {
                    element.addClass('active');
                } else {
                    element.removeClass('active');
                }
            });

            element.bind('mouseenter', function(e) {
                scope.$apply(function() { controller.activate(item); });
            });

            element.bind('click', function(e) {
                scope.$apply(function() { controller.select(item); });
            });
        }
    };
});
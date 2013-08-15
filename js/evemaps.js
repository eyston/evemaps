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

    function mapBounds(systems) {
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

    return {
        restrict: 'E',
        replace: true,
        template: '<svg></svg>',
        scope: {
            mode: "="
        },

        link: function(scope, element, attrs) {
            var svg = d3.select(element[0]);
            var map = svg.append('g');

            var view = {
                // screen resolution in pixels
                screen: {
                    h: $window.innerHeight,
                    w: $window.innerWidth
                },
                // map bounds in map coordinates
                map: mapBounds(mapsService.systems)
            };

            var size = 500;
            var x = d3.scale.linear()
                .domain([0, view.map.w])
                .range([0, size]);

            var z = d3.scale.linear()
                .domain([0, view.map.w])
                .range([0, -size]);

            var regionJumps = map.append('g');

            regionJumps.selectAll('line')
                .data(mapsService.regionJumps)
                .enter()
                    .append('line')
                    .attr('class', 'region')
                    .attr('x1', function(d) { return x(d.to.x); })
                    .attr('y1', function(d) { return z(d.to.z); })
                    .attr('x2', function(d) { return x(d.from.x); })
                    .attr('y2', function(d) { return z(d.from.z); });

            var jumps = map.append('g');

            jumps.selectAll('line')
                .data(mapsService.jumps)
                .enter()
                    .append('line')
                    .attr('class', 'solar')
                    .attr('x1', function(d) { return x(d.to.x); })
                    .attr('y1', function(d) { return z(d.to.z); })
                    .attr('x2', function(d) { return x(d.from.x); })
                    .attr('y2', function(d) { return z(d.from.z); });

            var systemTree = new RTree();
            _(mapsService.systems).each(function(s) {
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

            function centerOnPoint(view, point) {
                return [
                    view.screen.w / 2 - x(point.x),
                    z(point.y) + view.screen.h / 2
                ];
            };

            // we want to translate so map is in middle
            var translate = centerOnPoint(view, { x: view.map.x + view.map.w / 2, y: view.map.y + view.map.h / 2 });

            var zoom = d3.behavior.zoom()
                .scaleExtent([1, 128])
                .translate(translate)
                .scale(2)
                .on("zoom", zoomed);

            svg.call(zoom);

            var scale;
            var colors = d3.scale.category10();

            function zoomed() {
                map.attr('transform', 'translate(' + zoom.translate()[0] + ', ' + zoom.translate()[1] + ')scale(' + zoom.scale() + ')');

                // clean up below here!

                var newScale = zoom.scale() | 0;

                if(scale !== newScale)
                {
                    scale = newScale;
                    d3.select('svg g').attr('class', 'zoom' + Math.pow(2, ((Math.log(scale)/Math.log(2)) | 0)));
                }

                var bounds = {
                    x: x.invert((0 - zoom.translate()[0]) / zoom.scale()),
                    y: z.invert((view.screen.h - zoom.translate()[1]) / zoom.scale()),
                    w: (x.invert(view.screen.w) - x.invert(0)) / zoom.scale(),
                    h: (z.invert(0) - z.invert(view.screen.h)) / zoom.scale()
                };

                drawSystems(systemTree.search(bounds), scale);
            };

            function drawSystems(systems, scale) {

                if(scale > 8) {
                    var ss = map.selectAll('circle')
                        .data(systems, function(s) {
                            return s.id;
                        });

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
                        .data(systems, function(s) {
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
            };

            function zoomSystem(system) {

                // var height = 13896860379771180;
                var height = 30000000000000000;
                var width = height * (view.screen.w / view.screen.h);

                var scale = (z.invert(0) - z.invert(view.screen.h)) / height;

                var transform = {
                    scale: scale,
                    x: -x(system.x - width / 2) * scale,
                    y: view.screen.h - z(system.z - height / 2) * scale
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

            zoomed();

            $($window).bind("resize", function(ev) {
                view.screen = {
                    h: $window.innerHeight,
                    w: $window.innerWidth
                };
            });

            scope.$watch("mode", function(mode) {
                if(!mode) return;

                if(mode.type === "zoom") {
                    zoomSystem(mode.target);
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
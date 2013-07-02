angular.module('evemaps', []);

angular.module('evemaps').factory('MapsService', ['$window', function($window) {
    return {
        systems: $window.systems,
        jumps: $window.jumps
    };
}]);

angular.module('evemaps').factory('attrDirectiveLinker', function() {
    return function(attr, name) {
        return function(scope, element, attrs) {
            attrs.$observe(attr, function(value) {
                element.attr(name, value);
            });
        };
    };
});

_({ 'ngCx': 'cx', 'ngCy': 'cy', 'ngX1': 'x1', 'ngX2': 'x2', 'ngY1': 'y1', 'ngY2': 'y2' }).each(function(name, attr) {
    angular.module('evemaps').directive(attr, function() {
        return function(scope, element, attrs) {
            attrs.$observe(attr, function(value) {
                element.attr(name, value);
            });
        };
    });
});

angular.module('evemaps').controller('MapController', ['$scope', '$window', 'MapsService', function($scope, $window, mapsService) {

    var height = $window.innerHeight;
    var width = $window.innerWidth;

    // var regions = [10000060, 10000058, 10000054];
    // var regions = [10000060, 10000058, 10000054, 10000050, 10000063, 10000035];
    // var regions = [10000060, 10000058];
    // var regions = [10000060, 10000058, 10000054, 10000050, 10000063, 10000007];

    $scope.regionNames = {
        10000060: 'delve',
        10000058: 'fountain',
        10000054: 'aridia'
    };

    var visibleSystems = {};

    var showSystem = function(system) {
        if (system.regionId <= 10000030) {
            visibleSystems[system.id] = true;
            return true;
        }
        return false;
    };

    var showSolarJump = function(jump) {
        // return false;
        return jump.toRegionId === jump.fromRegionId && visibleSystems[jump.toSolarSystemId] && visibleSystems[jump.fromSolarSystemId];
    };

    var showRegionJump = function(jump) {
        // return false;
        return jump.toRegionId !== jump.fromRegionId && visibleSystems[jump.toSolarSystemId] && visibleSystems[jump.fromSolarSystemId];
    };

    var systems = _(mapsService.systems).filter(showSystem);
    var jumps = _(mapsService.jumps).filter(showSolarJump);
    var regionJumps = _(mapsService.jumps).filter(showRegionJump);

    $scope.systems = systems;
    $scope.jumps = _(jumps).map(function(j) {
        var to = _(systems).find(function(s) { return s.id === j.toSolarSystemId; });
        var from = _(systems).find(function(s) { return s.id === j.fromSolarSystemId; });

        return {
            to: to,
            from: from
        };
    });

    $scope.regionJumps = _(regionJumps).map(function(j) {
        var to = _(systems).find(function(s) { return s.id === j.toSolarSystemId; });
        var from = _(systems).find(function(s) { return s.id === j.fromSolarSystemId; });

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

    // ratios 2.676579925650558 0.40382735264940584

    // 96 x 304
    // 72 x 223

    $scope.x = d3.scale.linear()
        .domain([minX, maxX])
        .range([0, (height - 100) * mapRatio]);

    // $scope.y = d3.scale.linear()
    //     .domain([_(systems).min(function(s) { return s.y; }).y, _(systems).max(function(s) { return s.y; }).y])
    //     .range([50, height - 50]);

    $scope.z = d3.scale.linear()
        .domain([maxZ, minZ])
        .range([0, height - 100]);

    // console.log('x', $scope.x(1e17) - $scope.x(0));
    // console.log('z', $scope.z(1e17) - $scope.z(0));


    // console.log([_(systems).min(function(s) { return s.x; }).x, _(systems).max(function(s) { return s.x; }).x]);
    // console.log([_(systems).min(function(s) { return s.y; }).y, _(systems).max(function(s) { return s.y; }).y]);

}]);
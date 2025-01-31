module.exports = function(grunt) {

    var packages = [
        '*/package.json'
    ];

    // Project configuration.
    grunt.initConfig({
        pkg: grunt.file.readJSON('../package.json'),
        version: {
            src: packages
        },
        deps_manager: {
            options: {
                version: '^<%= pkg.version %>',
                pattern: ['kevoree-.*']
            },
            src: packages
        },
        publish: {
            options: {
                installBefore: true,
                ignore: [ 'node_modules' ]
            },
            src: [ '*' ]
        }
    });

    grunt.loadNpmTasks('grunt-version');
    grunt.loadNpmTasks('grunt-publish');
    grunt.loadNpmTasks('grunt-deps-manager');

    grunt.registerTask('release', ['version', 'deps_manager', 'publish']);
};

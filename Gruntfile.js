module.exports = function (grunt) {
    grunt.initConfig({
        pkg: grunt.file.readJSON('package.json'),
        connect: {
            server: {
                options: {
                    port: 8000,
                    livereload: true,
                    open: true
                },
            }
        },
        sass: {
            dist: {
                files: {
                    'dist/css/style.css': 'src/scss/style.scss',
                }
            }
        },
        watch: {
            options: {
                livereload: true,
            },
            html: {
                files: ['index.html'],
            },
            js: {
                files: ['dist/js/**/*.js'],
            },
            sass: {
                options: {
                    livereload: true
                },
                files: ['src/scss/**/*.scss'],
                tasks: ['sass'],
            },
            css: {
                files: ['dist/css/*.css'],
                tasks: []
            }
        }
    });

    // Actually running things.
    grunt.loadNpmTasks('grunt-contrib-sass');
    grunt.loadNpmTasks('grunt-contrib-watch');
    grunt.loadNpmTasks('grunt-contrib-connect');

    grunt.registerTask('default', ['connect', 'watch']);
};
module.exports = function(grunt) {

    grunt.loadNpmTasks("grunt-release");
    grunt.loadNpmTasks("grunt-tag");

    grunt.initConfig({
        release: {
            options: {
                npm: false,
                afterReleaseTasks: ["tag"],
                github: {
                    repo: "AirVantage/node-tech-db",
                    accessTokenVar: "GITHUB_ACCESS_TOKEN"
                }
            }
        },
        tag: {
            options: {
                tagName: "<%= version.match(/\\d*/) %>.x"
            }
        }
    });
};

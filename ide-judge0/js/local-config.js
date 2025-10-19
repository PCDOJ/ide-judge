// Local Judge0 API Configuration
// This file overrides the default Judge0 API URLs to use local instance

(function() {
    'use strict';

    // Check if we should use local Judge0 API
    // You can set this via environment variable or query parameter
    const useLocalAPI = true; // Set to true to use local Judge0 instance

    if (!useLocalAPI) {
        console.log('Using public Judge0 API');
        return;
    }

    console.log('Configuring local Judge0 API');

    // Override the base URLs
    // Note: This assumes the Judge0 server is accessible at /judge0-api
    // which should be proxied by the main web server
    const LOCAL_BASE_URL = window.location.origin + '/judge0-api';

    // Wait for the module to load and override
    const checkInterval = setInterval(function() {
        // Try to access the global variables from ide.js
        if (window.AUTHENTICATED_BASE_URL && window.UNAUTHENTICATED_BASE_URL) {
            clearInterval(checkInterval);

            // Override both authenticated and unauthenticated URLs
            window.AUTHENTICATED_BASE_URL.CE = LOCAL_BASE_URL;
            window.AUTHENTICATED_BASE_URL.EXTRA_CE = LOCAL_BASE_URL;
            window.UNAUTHENTICATED_BASE_URL.CE = LOCAL_BASE_URL;
            window.UNAUTHENTICATED_BASE_URL.EXTRA_CE = LOCAL_BASE_URL;

            console.log('Judge0 API URLs overridden to:', LOCAL_BASE_URL);
        }
    }, 100);

    // Timeout after 5 seconds
    setTimeout(function() {
        clearInterval(checkInterval);
    }, 5000);

})();


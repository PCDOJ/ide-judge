// Exam Integration Module
// This module handles communication between the IDE and the exam system

(function() {
    'use strict';

    // Check if running in iframe
    const isInIframe = window.self !== window.top;

    if (!isInIframe) {
        console.log('Not running in iframe, exam integration disabled');
        return;
    }

    console.log('Exam integration module loaded');

    // Listen for messages from parent window
    window.addEventListener('message', function(event) {
        // Security: verify origin if needed
        // if (event.origin !== 'expected-origin') return;

        console.log('[INTEGRATION] Received message:', event.data.type);
        const message = event.data;

        switch (message.type) {
            case 'loadCode':
                console.log('[INTEGRATION] Loading code, length:', message.code?.length);
                loadCodeIntoEditor(message.code, message.languageId);
                break;

            case 'getCode':
                console.log('[INTEGRATION] Getting code from editor');
                sendCodeToParent();
                break;

            default:
                console.log('[INTEGRATION] Unknown message type:', message.type);
        }
    });

    // Load code into editor
    function loadCodeIntoEditor(code, languageId) {
        // Wait for editor to be ready
        const checkEditor = setInterval(function() {
            if (window.sourceEditor && typeof window.sourceEditor.setValue === 'function') {
                clearInterval(checkEditor);
                
                // Set code
                window.sourceEditor.setValue(code || '');
                
                // Set language if provided
                if (languageId) {
                    const selectLanguage = document.getElementById('select-language');
                    if (selectLanguage) {
                        selectLanguage.value = languageId;
                        // Trigger change event
                        const event = new Event('change', { bubbles: true });
                        selectLanguage.dispatchEvent(event);
                    }
                }
                
                console.log('Code loaded into editor');
            }
        }, 100);

        // Timeout after 10 seconds
        setTimeout(function() {
            clearInterval(checkEditor);
        }, 10000);
    }

    // Send code to parent window
    function sendCodeToParent() {
        console.log('[INTEGRATION] sendCodeToParent called');

        if (!window.sourceEditor || typeof window.sourceEditor.getValue !== 'function') {
            console.error('[INTEGRATION] Editor not ready');
            return;
        }

        const code = window.sourceEditor.getValue();
        const selectLanguage = document.getElementById('select-language');
        const languageId = selectLanguage ? selectLanguage.value : null;
        const languageName = selectLanguage ? selectLanguage.options[selectLanguage.selectedIndex].text : null;

        console.log('[INTEGRATION] Code length:', code?.length, 'Language:', languageId, languageName);

        window.parent.postMessage({
            type: 'codeData',
            code: code,
            languageId: languageId,
            languageName: languageName
        }, '*');

        console.log('[INTEGRATION] Code sent to parent');
    }

    // Auto-send code on change (debounced)
    let autoSendTimeout = null;
    function setupAutoSend() {
        const checkEditor = setInterval(function() {
            if (window.sourceEditor && typeof window.sourceEditor.onDidChangeModelContent === 'function') {
                clearInterval(checkEditor);
                
                window.sourceEditor.onDidChangeModelContent(function() {
                    // Debounce: wait 2 seconds after last change
                    if (autoSendTimeout) {
                        clearTimeout(autoSendTimeout);
                    }
                    
                    autoSendTimeout = setTimeout(function() {
                        // Don't auto-send, let parent request it
                        // sendCodeToParent();
                    }, 2000);
                });
                
                console.log('Auto-send setup complete');
            }
        }, 100);

        // Timeout after 10 seconds
        setTimeout(function() {
            clearInterval(checkEditor);
        }, 10000);
    }

    // Initialize
    setupAutoSend();

    // Wait for editor to be ready before notifying parent
    function notifyParentWhenReady() {
        const checkEditor = setInterval(function() {
            if (window.sourceEditor && typeof window.sourceEditor.getValue === 'function') {
                clearInterval(checkEditor);

                // Notify parent that iframe is ready
                window.parent.postMessage({
                    type: 'iframeReady'
                }, '*');

                console.log('[INTEGRATION] Iframe ready notification sent');
            }
        }, 100);

        // Timeout after 10 seconds
        setTimeout(function() {
            clearInterval(checkEditor);
            console.warn('[INTEGRATION] Editor not ready after 10 seconds');
        }, 10000);
    }

    notifyParentWhenReady();

})();


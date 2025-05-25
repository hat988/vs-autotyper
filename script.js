document.addEventListener('DOMContentLoaded', () => {
            const noteInput = document.getElementById('note-input');
            const outputEditor = document.getElementById('output-editor');
            const saveBtn = document.getElementById('save-btn');
            const loadBtn = document.getElementById('load-btn');
            const runBtn = document.getElementById('run-btn');
            const clearBtn = document.getElementById('clear-btn');
            const statusMessage = document.getElementById('status-message');
            const typingAudio = document.getElementById('typing-sound'); // Ensure this ID matches your audio tag
            const storageKeyPrefix = 'vsCodePadNote_'; 

            const fileListUL = document.getElementById('file-list-ul');
            const addFileBtnHeader = document.getElementById('add-file-btn-header');
            const currentFileTab = document.getElementById('current-file-tab');
            
            const toastContainer = document.getElementById('toast-container');

            const typingSpeedSlider = document.getElementById('typing-speed-slider');
            const speedValueDisplay = document.getElementById('speed-value-display');

            let typeItInstance = null;
            let tempFiles = [];
            let activeFileId = null;
            let typingSpeed = 30; 

            const showToast = (message, type = 'info', duration = 3000) => {
                const toast = document.createElement('div');
                toast.className = `toast ${type}`;
                
                let iconClass = 'fa-solid fa-info-circle';
                if (type === 'success') iconClass = 'fa-solid fa-check-circle';
                else if (type === 'error') iconClass = 'fa-solid fa-times-circle';

                toast.innerHTML = `<i class="${iconClass}"></i> ${message}`;
                toastContainer.appendChild(toast);
                toast.offsetHeight; 
                toast.classList.add('show');

                setTimeout(() => {
                    toast.classList.remove('show');
                    setTimeout(() => {
                        if (toast.parentElement) {
                           toast.parentElement.removeChild(toast);
                        }
                    }, 300); 
                }, duration);
            };

            const updateStatus = (message, persistent = false) => {
                statusMessage.textContent = message;
                if (!persistent) {
                    setTimeout(() => {
                        if (statusMessage.textContent === message) { 
                           statusMessage.textContent = 'Ready';
                        }
                    }, 3000);
                }
            };

            const stopTypingSound = () => {
                if (typingAudio) {
                    typingAudio.pause();
                    typingAudio.currentTime = 0;
                }
            };

            const playTypingSound = () => {
                if (typingAudio) {
                    typingAudio.play().catch(e => {
                        console.error("Audio play failed. Ensure 'typing-sound.mp3' is in the same directory as the HTML file and the browser allows autoplay.", e);
                        // showToast("Typing sound could not be played.", "error"); // Optional: notify user
                    });
                }
            };

            const showEditor = () => {
                if (typeItInstance) {
                    try { typeItInstance.destroy(); } catch (e) { console.warn("Could not destroy TypeIt instance:", e); }
                    typeItInstance = null;
                }
                stopTypingSound();
                outputEditor.style.display = 'none';
                outputEditor.innerHTML = '';
                noteInput.style.display = 'block';
                noteInput.focus();
            };

            const showOutput = () => {
                noteInput.style.display = 'none';
                outputEditor.innerHTML = '';
                outputEditor.style.display = 'block';
            };
            
            const getFileIconClass = (fileName) => {
                if (fileName.endsWith('.js')) return 'fa-brands fa-js-square';
                if (fileName.endsWith('.html')) return 'fa-brands fa-html5';
                if (fileName.endsWith('.css')) return 'fa-brands fa-css3-alt';
                if (fileName.endsWith('.json')) return 'fa-solid fa-file-code'; 
                if (fileName.endsWith('.txt')) return 'fa-solid fa-file-alt';
                return 'fa-solid fa-file'; 
            };

            const renderFileList = () => {
                fileListUL.innerHTML = '';
                if (tempFiles.length === 0) {
                    fileListUL.innerHTML = '<li style="opacity:0.6; pointer-events:none;"><i class="fa-solid fa-folder-open"></i> No temporary files.</li>';
                    return;
                }
                tempFiles.forEach(file => {
                    const li = document.createElement('li');
                    li.dataset.fileId = file.id;
                    const iconClass = getFileIconClass(file.name);
                    li.innerHTML = `<i class="fa-solid ${iconClass}"></i> <span class="file-name-display">${file.name}</span>`;
                    
                    const deleteBtn = document.createElement('button');
                    deleteBtn.className = 'delete-file-btn';
                    deleteBtn.innerHTML = '<i class="fa-solid fa-times"></i>';
                    deleteBtn.title = 'Delete this temporary file';
                    deleteBtn.onclick = (e) => {
                        e.stopPropagation(); 
                        deleteTemporaryFile(file.id);
                    };
                    li.appendChild(deleteBtn);

                    if (file.id === activeFileId) {
                        li.classList.add('active-file');
                    }
                    li.addEventListener('click', () => switchActiveFile(file.id));
                    fileListUL.appendChild(li);
                });
            };

            const updateCurrentFileTab = () => {
                const activeFile = tempFiles.find(f => f.id === activeFileId);
                if (activeFile) {
                    const iconClass = getFileIconClass(activeFile.name);
                    currentFileTab.innerHTML = `<i class="fa-solid ${iconClass}"></i> ${activeFile.name}`;
                } else {
                    currentFileTab.innerHTML = `<i class="fa-solid fa-file-circle-question"></i> No file selected`;
                }
            };
            
            const createNewTemporaryFile = (fileNameFromPrompt = null) => {
                // Save content of the current file *before* creating a new one and switching
                saveCurrentFileContentToMemory(); 

                const fileName = fileNameFromPrompt || prompt("Enter new file name (e.g., script.js):", `untitled-${tempFiles.length + 1}.js`);
                if (fileName && fileName.trim() !== "") {
                    const newFile = {
                        id: Date.now(),
                        name: fileName.trim(),
                        content: `// New file: ${fileName.trim()}\n`
                    };
                    tempFiles.push(newFile);
                    switchActiveFile(newFile.id, true); // true to skip saving again, as we just did
                    renderFileList(); // render before showEditor to avoid flicker if showEditor clears list
                    showEditor(); // Set focus to editor for the new file
                    showToast(`File '${newFile.name}' created.`, 'success');
                } else if (!fileNameFromPrompt) { 
                    showToast('File creation cancelled.', 'info');
                }
            };

            const deleteTemporaryFile = (fileIdToDelete) => {
                const fileIndex = tempFiles.findIndex(f => f.id === fileIdToDelete);
                if (fileIndex === -1) return;

                const deletedFileName = tempFiles[fileIndex].name;

                if (tempFiles.length === 1 && fileIdToDelete === activeFileId) {
                    tempFiles[0].content = "// Editor cleared. Start fresh or create another file.\n";
                    tempFiles[0].name = "untitled-1.js"; 
                    activeFileId = tempFiles[0].id; // Ensure activeFileId is still valid
                    noteInput.value = tempFiles[0].content;
                    showEditor();
                    renderFileList();
                    updateCurrentFileTab();
                    showToast("Last file content cleared. Renamed.", 'info');
                    return;
                }
                
                tempFiles.splice(fileIndex, 1);
                if (activeFileId === fileIdToDelete) { 
                    activeFileId = tempFiles.length > 0 ? tempFiles[Math.max(0, fileIndex -1) % tempFiles.length].id : null;
                    if (activeFileId) {
                         switchActiveFile(activeFileId, true); 
                    } else {
                         createNewTemporaryFile("default.js"); 
                    }
                }
                renderFileList(); // Re-render after potential switch or if a non-active file was deleted
                showToast(`File '${deletedFileName}' deleted.`, 'info');

                if (tempFiles.length === 0) { 
                    createNewTemporaryFile("fallback.js");
                }
            };

            const switchActiveFile = (fileId, skipSave = false) => {
                if (!skipSave) {
                    saveCurrentFileContentToMemory(); 
                }
                
                const newActiveFile = tempFiles.find(f => f.id === fileId);
                if (newActiveFile) {
                    activeFileId = fileId;
                    noteInput.value = newActiveFile.content;
                    renderFileList(); // Update highlighting in file list
                    updateCurrentFileTab(); // Update tab name
                    showEditor(); // Ensure editor is displayed for the new file
                    updateStatus(`Active file: ${newActiveFile.name}`);
                }
            };
            
            const saveCurrentFileContentToMemory = () => {
                if (activeFileId) {
                    const currentFile = tempFiles.find(f => f.id === activeFileId);
                    if (currentFile) {
                        // console.log("Saving to memory for file ID:", activeFileId, "Name:", currentFile.name, "Content:", noteInput.value.substring(0,50) + "...");
                        currentFile.content = noteInput.value;
                    }
                }
            };

            const saveActiveFileToStorage = () => {
                if (!activeFileId) {
                    showToast('No active file to save.', 'error');
                    return;
                }
                saveCurrentFileContentToMemory(); 
                const activeFile = tempFiles.find(f => f.id === activeFileId);
                if (activeFile) {
                    try {
                        localStorage.setItem(storageKeyPrefix + activeFile.name, activeFile.content);
                        showToast(`File '${activeFile.name}' saved.`, 'success');
                    } catch (e) {
                        showToast('Error saving file.', 'error');
                        console.error("Save Error:", e);
                    }
                }
            };

            const loadActiveFileFromStorage = () => {
                if (!activeFileId) {
                    showToast('No active file selected to load into.', 'error');
                    return;
                }
                const activeFile = tempFiles.find(f => f.id === activeFileId);
                if (activeFile) {
                    showEditor();
                    try {
                        const savedNote = localStorage.getItem(storageKeyPrefix + activeFile.name);
                        if (savedNote !== null) {
                            activeFile.content = savedNote;
                            noteInput.value = savedNote;
                            showToast(`Content for '${activeFile.name}' loaded.`, 'success');
                        } else {
                            showToast(`No saved data found for '${activeFile.name}'.`, 'info');
                        }
                    } catch (e)
                    {
                        showToast('Error loading file.', 'error');
                        console.error("Load Error:", e);
                    }
                }
            };

            const clearEditorAndUpdateMemory = () => {
                showEditor(); 
                noteInput.value = ''; 
                saveCurrentFileContentToMemory(); 
                const activeFile = tempFiles.find(f => f.id === activeFileId);
                if (activeFile) {
                    showToast(`Editor for '${activeFile.name}' cleared.`, 'info');
                } else {
                    showToast('Editor cleared.', 'info');
                }
            };

           
const runTyping = () => {
                saveCurrentFileContentToMemory(); // Make sure latest content is used
                const activeFile = tempFiles.find(f => f.id === activeFileId);
                
                if (typeItInstance) {
                    updateStatus("Execution already in progress or finished. Click Load/Clear to edit again."); /* [cite: 97] */
                    return; 
                }

                if (activeFile && activeFile.content && activeFile.content.trim() !== '') {
                    showOutput(); /* [cite: 99] */
                    updateStatus(`Executing '${activeFile.name}'...`, true); /* [cite: 99] */

                    const highlightedResult = hljs.highlightAuto(activeFile.content);
                    const highlightedHTML = highlightedResult.value;
                    
                    typingAudio.play().catch(e => console.error("Audio play failed. Ensure 'typing-sound.mp3' is present.", e)); /* [cite: 100, 101] */
                    
                    typeItInstance = new TypeIt('#output-editor', { /* [cite: 102] */
                        strings: [highlightedHTML],
                        speed: typingSpeed, // Use dynamic speed
                        waitUntilVisible: true,
                        lifeLike: false, /* [cite: 103] */
                        html: true,
                        cursor: true,
                        cursorChar: '█',
                        afterComplete: (instance) => { /* [cite: 104] */
                            stopTypingSound();
                            updateStatus(`'${activeFile.name}' execution complete. Click Load/Clear to edit.`);
                        },
                        onError: (err) => { /* [cite: 105] */
                             console.error("TypeIt Error:", err); /* [cite: 105] */
                             updateStatus('Typing error occurred.'); /* [cite: 105] */
                             showEditor(); // Go back to editor on error /* [cite: 106] */
                        }
                    }).go();
                } else {
                    updateStatus('No script in the active file to execute. Write some code first.'); /* [cite: 107] */
                }
            };



            // Event Listeners
            addFileBtnHeader.addEventListener('click', () => createNewTemporaryFile());
            saveBtn.addEventListener('click', saveActiveFileToStorage);
            loadBtn.addEventListener('click', loadActiveFileFromStorage);
            runBtn.addEventListener('click', runTyping);
            clearBtn.addEventListener('click', clearEditorAndUpdateMemory);
            
            typingSpeedSlider.addEventListener('input', (e) => {
                typingSpeed = parseInt(e.target.value, 10);
                speedValueDisplay.textContent = typingSpeed;
                console.log("Slider changed, new speed value:", typingSpeed); // Speed log
            });

            // Initial Load
            const defaultFileName = 'example.js';
            const defaultContent = `// Welcome to KS-Autotyper!
// Use the '+' button in the header to create new files.
// Adjust typing speed using the slider in the sidebar.
// Your scripts are temporary and will be lost on browser reload unless saved.

function calculateFactorial(num) {
  if (num < 0) {
    return "Factorial is not defined for negative numbers.";
  } else if (num === 0) {
    return 1;
  } else {
    let result = 1;
    for (let i = 1; i <= num; i++) {
      result *= i;
    }
    return result;
  }
}

console.log("Factorial of 5 is: " + calculateFactorial(5));
console.log("Try running this script with different speeds!");
`;
            let initialFileContent = localStorage.getItem(storageKeyPrefix + defaultFileName) || defaultContent;
            const initialFile = { id: Date.now(), name: defaultFileName, content: initialFileContent };
            tempFiles.push(initialFile);
            activeFileId = initialFile.id;
            
            noteInput.value = initialFile.content;
            renderFileList();
            updateCurrentFileTab();
            showEditor(); 
            updateStatus('KS-Autotyper Ready.');
            showToast('Welcome to KS-Autotyper!', 'info', 4000);
        });
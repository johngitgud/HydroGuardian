// Download Manager
class DownloadManager {
    constructor() {
        this.isDownloading = false;
        this.currentDownload = null;
        this.retryCount = 0;
        this.maxRetries = 3;
        this.abortController = null;
        this.init();
    }

    init() {
        this.attachEventListeners();
    }

    attachEventListeners() {
        // Download button listeners
        const downloadButtons = document.querySelectorAll('.download-btn');
        downloadButtons.forEach(button => {
            button.addEventListener('click', (e) => this.startDownload(e));
        });

        // Cancel button
        document.getElementById('cancelBtn').addEventListener('click', () => this.cancelDownload());

        // Reset button
        document.getElementById('resetBtn').addEventListener('click', () => this.resetDownload());

        // Retry button
        document.getElementById('retryBtn').addEventListener('click', () => this.retryDownload());
    }

    startDownload(event) {
        if (this.isDownloading) return;

        const button = event.target.closest('.download-btn');
        const platform = button.dataset.platform;
        const filename = button.dataset.filename;
        const filesize = button.dataset.size;
        const primaryUrl = button.dataset.url;
        const fallbackUrl = button.dataset.fallbackUrl;

        // Hide main content and show progress
        this.hideAllSections();
        this.showProgressSection(filename, filesize);

        this.isDownloading = true;
        this.currentDownload = {
            filename,
            filesize,
            platform,
            primaryUrl,
            fallbackUrl,
            startedAt: Date.now(),
            bytesReceived: 0,
            totalBytes: 0
        };

        this.retryCount = 0;
        this.performDownload();
    }

    async performDownload() {
        const loadingText = document.getElementById('loadingText');
        const detailStatus = document.getElementById('detailStatus');

        const candidateUrls = [
            this.currentDownload.primaryUrl,
            this.currentDownload.fallbackUrl
        ].filter(Boolean);

        for (const url of candidateUrls) {
            try {
                loadingText.textContent = 'Preparing secure download...';
                detailStatus.textContent = 'Connecting...';
                await this.downloadFromUrl(url, this.currentDownload.filename);
                this.completeDownload();
                return;
            } catch (error) {
                if (error.name === 'AbortError') {
                    return;
                }
            }
        }

        this.isDownloading = false;
        this.showDownloadError('Could not download HydroGuardian.apk from configured sources. Upload the APK to GitHub Release assets or place it beside index.html.');
    }

    async downloadFromUrl(url, filename) {
        this.abortController = new AbortController();
        const startTime = performance.now();
        const response = await fetch(url, {
            method: 'GET',
            signal: this.abortController.signal,
            cache: 'no-store'
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const contentLengthHeader = response.headers.get('content-length');
        const totalBytes = contentLengthHeader ? parseInt(contentLengthHeader, 10) : 0;
        this.currentDownload.totalBytes = Number.isFinite(totalBytes) ? totalBytes : 0;

        const detailStatus = document.getElementById('detailStatus');
        detailStatus.textContent = 'Downloading...';
        if (this.currentDownload.totalBytes > 0) {
            this.currentDownload.filesize = this.formatBytes(this.currentDownload.totalBytes);
            document.getElementById('detailSize').textContent = this.currentDownload.filesize;
        }

        // Fallback for browsers/environments without stream support.
        if (!response.body || !response.body.getReader) {
            const blobNoStream = await response.blob();
            this.saveBlob(blobNoStream, filename);
            return;
        }

        const reader = response.body.getReader();
        const chunks = [];
        let receivedBytes = 0;

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            chunks.push(value);
            receivedBytes += value.length;
            this.currentDownload.bytesReceived = receivedBytes;
            this.updateDownloadProgress(receivedBytes, this.currentDownload.totalBytes, startTime);
        }

        const blob = new Blob(chunks);
        this.saveBlob(blob, filename);
    }

    updateDownloadProgress(receivedBytes, totalBytes, startTime) {
        const progress = totalBytes > 0 ? (receivedBytes / totalBytes) * 100 : 0;

        const progressFill = document.getElementById('progressFill');
        const progressPercent = document.getElementById('progressPercent');
        const progressSpeed = document.getElementById('progressSpeed');
        const loadingText = document.getElementById('loadingText');
        const detailStatus = document.getElementById('detailStatus');

        const elapsedSeconds = Math.max((performance.now() - startTime) / 1000, 0.1);
        const bytesPerSecond = receivedBytes / elapsedSeconds;

        if (totalBytes > 0) {
            progressFill.style.width = `${Math.min(progress, 99.9)}%`;
            progressPercent.textContent = `${Math.floor(progress)}%`;
            loadingText.textContent = 'Downloading HydroGuardian.apk...';
        } else {
            progressFill.style.width = '35%';
            progressPercent.textContent = '...';
            loadingText.textContent = 'Streaming download...';
        }

        progressSpeed.textContent = `${this.formatBytes(bytesPerSecond)}/s`;
        detailStatus.textContent = `Received ${this.formatBytes(receivedBytes)}`;
    }

    saveBlob(blob, filename) {
        const objectUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = objectUrl;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(objectUrl);
    }

    completeDownload() {
        const progressFill = document.getElementById('progressFill');
        const progressPercent = document.getElementById('progressPercent');
        const loadingText = document.getElementById('loadingText');
        const detailStatus = document.getElementById('detailStatus');

        // Complete the progress bar
        progressFill.style.width = '100%';
        progressPercent.textContent = '100%';
        loadingText.textContent = 'Download complete!';
        detailStatus.textContent = 'Completed';

        // Wait a moment then show success
        setTimeout(() => {
            this.showSuccessMessage();
            this.isDownloading = false;
        }, 800);
    }

    cancelDownload() {
        if (this.abortController) {
            this.abortController.abort();
        }
        this.isDownloading = false;
        this.currentDownload = null;
        this.hideAllSections();
        document.querySelector('.download-section').style.display = 'block';
    }

    showDownloadError(message) {
        this.hideAllSections();
        document.getElementById('errorSection').style.display = 'block';
        const errorText = document.getElementById('errorText');

        if (this.retryCount < this.maxRetries) {
            errorText.textContent = message || `Download failed. You can retry (${this.retryCount + 1}/${this.maxRetries}).`;
        } else {
            errorText.textContent = 'Maximum retries reached. Please try again later.';
            document.getElementById('retryBtn').disabled = true;
        }
    }

    retryDownload() {
        this.retryCount++;
        const errorBtn = document.getElementById('retryBtn');

        if (this.retryCount < this.maxRetries) {
            this.hideAllSections();
            this.showProgressSection(
                this.currentDownload.filename,
                this.currentDownload.filesize
            );
            this.isDownloading = true;
            this.performDownload();
        } else {
            errorBtn.disabled = true;
        }
    }

    resetDownload() {
        this.isDownloading = false;
        this.currentDownload = null;
        this.retryCount = 0;
        this.hideAllSections();
        document.querySelector('.download-section').style.display = 'block';
        
        // Re-enable all buttons
        document.querySelectorAll('.download-btn').forEach(btn => {
            btn.disabled = false;
        });
        document.getElementById('retryBtn').disabled = false;
        document.getElementById('progressFill').style.width = '0%';
        document.getElementById('progressPercent').textContent = '0%';
        document.getElementById('progressSpeed').textContent = '0 KB/s';
    }

    showProgressSection(filename, filesize) {
        const progressSection = document.getElementById('progressSection');
        const downloadingFile = document.getElementById('downloadingFile');
        const detailFile = document.getElementById('detailFile');
        const detailSize = document.getElementById('detailSize');

        downloadingFile.textContent = filename;
        detailFile.textContent = filename;
        detailSize.textContent = filesize;

        progressSection.style.display = 'block';
    }

    showSuccessMessage() {
        this.hideAllSections();
        const successSection = document.getElementById('successSection');
        const successText = document.getElementById('successText');

        successText.textContent = `${this.currentDownload.filename} has been downloaded successfully. File size: ${this.currentDownload.filesize}.`;

        successSection.style.display = 'block';
    }

    formatBytes(bytes) {
        if (!bytes || bytes <= 0) return '0 B';
        const units = ['B', 'KB', 'MB', 'GB'];
        let value = bytes;
        let unitIndex = 0;
        while (value >= 1024 && unitIndex < units.length - 1) {
            value /= 1024;
            unitIndex += 1;
        }
        return `${value.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
    }

    hideAllSections() {
        document.getElementById('progressSection').style.display = 'none';
        document.getElementById('successSection').style.display = 'none';
        document.getElementById('errorSection').style.display = 'none';
    }
}

let downloadManager;

// Initialize Download Manager when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    downloadManager = new DownloadManager();

    // Add smooth scroll behavior
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({ behavior: 'smooth' });
            }
        });
    });

    // Intersection Observer for fade-in animations
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
            }
        });
    }, observerOptions);

    // Observe elements for animation
    document.querySelectorAll('.feature-card, .download-card').forEach(el => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(20px)';
        el.style.transition = 'all 0.6s ease-out';
        observer.observe(el);
    });

    // Add keyboard support
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && downloadManager && downloadManager.isDownloading) {
            downloadManager.cancelDownload();
        }
    });
});

// Performance optimization: Reduce animation frame rate on low-end devices
function detectDevicePerformance() {
    const cores = navigator.hardwareConcurrency || 1;
    if (cores <= 2) {
        document.documentElement.style.setProperty('--transition', 'all 0.2s ease');
    }
}

detectDevicePerformance();


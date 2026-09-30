class ContactUsManager {
    constructor() {
        this.phoneNum = "923262116352";
        this.openWaBtn = document.getElementById('openWaBtn');
        this.init();
    }

    init() {
        this.openWaBtn?.addEventListener('click', () => this.redirectToWhatsApp());
    }

    redirectToWhatsApp() {
        const message = encodeURIComponent("Hello CyberGuard Support, I need assistance.");
        const waUrl = `https://wa.me/${this.phoneNum}?text=${message}`;
        window.open(waUrl, '_blank');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new ContactUsManager();
});
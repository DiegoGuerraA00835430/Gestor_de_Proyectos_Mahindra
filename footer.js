class AppFooter extends HTMLElement {
    connectedCallback(){
        this.innerHTML = `
        <style>
            .footer {
            text-align: center;
            margin-top: 2rem;
            }
        </style>

        <footer class="footer">
                <p>Project Management Dashboard &copy; 2024</p>
        </footer>
        `;
    }
}

customElements.define("app-footer", AppFooter);
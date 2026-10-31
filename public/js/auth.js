/* ============================================================
   LOCAL TRAILS — auth.js
   Shared validation utilities + form-specific logic
   ============================================================ */

// ── Validators ────────────────────────────────────────────────
function validateEmail(val) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val.trim());
}

function validateMobile(val) {
    return /^[6-9]\d{9}$/.test(val.trim());
}

function validatePassword(val) {
    return val.length >= 8;
}

function passwordStrength(val) {
    if (val.length < 6) return "weak";
    const hasUpper  = /[A-Z]/.test(val);
    const hasNumber = /\d/.test(val);
    const hasSymbol = /[^A-Za-z0-9]/.test(val);
    const score = [hasUpper, hasNumber, hasSymbol].filter(Boolean).length;
    if (val.length >= 8 && score >= 2) return "strong";
    if (val.length >= 6 && score >= 1) return "fair";
    return "weak";
}

// ── DOM helpers ───────────────────────────────────────────────
function showError(inputEl, message) {
    const wrap = inputEl.closest(".input-wrap") || inputEl.parentElement;
    inputEl.classList.add("error");
    inputEl.classList.remove("valid");

    let errEl = wrap.parentElement.querySelector(".form-error");
    if (!errEl) {
        errEl = document.createElement("span");
        errEl.className = "form-error";
        wrap.parentElement.appendChild(errEl);
    }
    errEl.textContent = "⚠ " + message;
    errEl.classList.add("visible");
}

function clearError(inputEl) {
    const wrap = inputEl.closest(".input-wrap") || inputEl.parentElement;
    inputEl.classList.remove("error");
    inputEl.classList.add("valid");

    const errEl = wrap.parentElement.querySelector(".form-error");
    if (errEl) errEl.classList.remove("visible");
}

function showFormAlert(alertEl, message, type = "error") {
    alertEl.textContent = (type === "error" ? "⚠ " : "✓ ") + message;
    alertEl.className = `form-alert visible ${type === "error" ? "error-alert" : "success-alert"}`;
}

function hideFormAlert(alertEl) {
    alertEl.classList.remove("visible");
}

// ── Password toggle ────────────────────────────────────────────
function initPasswordToggles() {
    document.querySelectorAll(".toggle-password").forEach(btn => {
        btn.addEventListener("click", () => {
            const input = btn.previousElementSibling;
            if (!input) return;
            const isHidden = input.type === "password";
            input.type = isHidden ? "text" : "password";
            btn.textContent = isHidden ? "🙈" : "👁️";
        });
    });
}

// ── REGISTER form logic ───────────────────────────────────────
function initRegisterForm() {
    const form        = document.getElementById("registerForm");
    if (!form) return;

    const nameInput     = document.getElementById("regName");
    const emailInput    = document.getElementById("regEmail");
    const mobileInput   = document.getElementById("regMobile");
    const passwordInput = document.getElementById("regPassword");
    const confirmInput  = document.getElementById("regConfirm");
    const formAlert     = document.getElementById("formAlert");

    // ── Password strength meter
    const strengthWrap  = document.getElementById("strengthWrap");
    const strengthFill  = document.getElementById("strengthFill");
    const strengthLabel = document.getElementById("strengthLabel");

    if (passwordInput && strengthWrap) {
        passwordInput.addEventListener("input", () => {
            const val = passwordInput.value;
            const level = passwordStrength(val);
            strengthWrap.className = `password-strength strength-${level}`;
            strengthLabel.textContent =
                level === "strong" ? "Strong password" :
                level === "fair"   ? "Fair — add symbols or numbers" :
                                     "Weak — too short or simple";
        });
    }

    // ── Per-field blur validation
    if (nameInput) {
        nameInput.addEventListener("blur", () => {
            const val = nameInput.value.trim();
            if (!val)          showError(nameInput, "Full name is required.");
            else if (val.length < 3) showError(nameInput, "Name must be at least 3 characters.");
            else               clearError(nameInput);
        });
    }

    if (emailInput) {
        emailInput.addEventListener("blur", () => {
            const val = emailInput.value;
            if (!val.trim())       showError(emailInput, "Email address is required.");
            else if (!validateEmail(val)) showError(emailInput, "Enter a valid email address.");
            else                   clearError(emailInput);
        });
    }

    if (mobileInput) {
        mobileInput.addEventListener("blur", () => {
            const val = mobileInput.value.trim();
            if (!val)                 showError(mobileInput, "Mobile number is required.");
            else if (!validateMobile(val)) showError(mobileInput, "Enter a valid 10-digit Indian mobile number.");
            else                      clearError(mobileInput);
        });
    }

    if (passwordInput) {
        passwordInput.addEventListener("blur", () => {
            const val = passwordInput.value;
            if (!val)                    showError(passwordInput, "Password is required.");
            else if (!validatePassword(val)) showError(passwordInput, "Password must be at least 8 characters.");
            else                         clearError(passwordInput);
        });
    }

    if (confirmInput && passwordInput) {
        confirmInput.addEventListener("blur", () => {
            if (!confirmInput.value) {
                showError(confirmInput, "Please confirm your password.");
            } else if (confirmInput.value !== passwordInput.value) {
                showError(confirmInput, "Passwords do not match.");
            } else {
                clearError(confirmInput);
            }
        });
    }

    // ── Submit
    form.addEventListener("submit", (e) => {
        e.preventDefault();
        let valid = true;

        const name    = nameInput?.value.trim()    || "";
        const email   = emailInput?.value.trim()   || "";
        const mobile  = mobileInput?.value.trim()  || "";
        const pass    = passwordInput?.value        || "";
        const confirm = confirmInput?.value         || "";

        // Role
        const roleEl = form.querySelector('input[name="role"]:checked');

        if (!name || name.length < 3) {
            showError(nameInput, !name ? "Full name is required." : "Name must be at least 3 characters.");
            valid = false;
        }
        if (!email || !validateEmail(email)) {
            showError(emailInput, !email ? "Email is required." : "Enter a valid email.");
            valid = false;
        }
        if (!mobile || !validateMobile(mobile)) {
            showError(mobileInput, !mobile ? "Mobile number is required." : "Enter a valid 10-digit mobile number.");
            valid = false;
        }
        if (!pass || !validatePassword(pass)) {
            showError(passwordInput, !pass ? "Password is required." : "Password must be at least 8 characters.");
            valid = false;
        }
        if (!confirm || confirm !== pass) {
            showError(confirmInput, !confirm ? "Please confirm your password." : "Passwords do not match.");
            valid = false;
        }
        if (!roleEl) {
            showFormAlert(formAlert, "Please select your account type.", "error");
            valid = false;
        }

        if (!valid) {
            if (roleEl) showFormAlert(formAlert, "Please fix the errors above before continuing.", "error");
            return;
        }

        // Simulate success (tomorrow: replace with fetch POST /api/auth/register)
        hideFormAlert(formAlert);
        showFormAlert(formAlert, "Registration successful! Redirecting to login…", "success");
        setTimeout(() => { window.location.href = "login.html"; }, 1800);
    });
}

// ── LOGIN form logic ──────────────────────────────────────────
function initLoginForm() {
    const form        = document.getElementById("loginForm");
    if (!form) return;

    const emailInput    = document.getElementById("loginEmail");
    const passwordInput = document.getElementById("loginPassword");
    const formAlert     = document.getElementById("loginAlert");

    form.addEventListener("submit", (e) => {
        e.preventDefault();
        let valid = true;

        const email = emailInput?.value.trim() || "";
        const pass  = passwordInput?.value     || "";

        if (!email || !validateEmail(email)) {
            showError(emailInput, !email ? "Email is required." : "Enter a valid email address.");
            valid = false;
        } else {
            clearError(emailInput);
        }

        if (!pass) {
            showError(passwordInput, "Password is required.");
            valid = false;
        } else {
            clearError(passwordInput);
        }

        if (!valid) {
            showFormAlert(formAlert, "Please enter your email and password.", "error");
            return;
        }

        // Simulate login (tomorrow: replace with fetch POST /api/auth/login)
        hideFormAlert(formAlert);
        showFormAlert(formAlert, "Login successful! Redirecting…", "success");
        setTimeout(() => { window.location.href = "index.html"; }, 1500);
    });

    // Clear errors on input
    emailInput?.addEventListener("input", () => {
        if (emailInput.classList.contains("error")) {
            if (validateEmail(emailInput.value)) clearError(emailInput);
        }
    });

    passwordInput?.addEventListener("input", () => {
        if (passwordInput.classList.contains("error") && passwordInput.value.length > 0) {
            clearError(passwordInput);
        }
    });
}

// ── Init ──────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
    initPasswordToggles();
    initRegisterForm();
    initLoginForm();
});

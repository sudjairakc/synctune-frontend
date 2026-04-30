<script>
  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080'
  const qrUrl = `${API_URL}/qr/promptpay`
</script>

<section class="support-section">
  <h2 class="support-title">☕ Support Me</h2>
  <p class="support-desc">ถ้าชอบ SyncTune สแกน PromptPay โอนกาแฟสักแก้วได้เลยครับ</p>
  <div class="qr-wrapper">
    <img src={qrUrl} alt="PromptPay QR" class="qr-img" />
  </div>
  <p class="support-note">PromptPay · เบอร์ 085-399-7206</p>
</section>

<style>
  .support-section {
    background: var(--bg-surface);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 20px;
    text-align: center;
  }

  .support-title {
    margin: 0 0 8px;
    font-size: 1rem;
    font-weight: 600;
    color: var(--text-primary);
  }

  .support-desc {
    margin: 0 0 16px;
    font-size: 0.8rem;
    color: var(--text-secondary);
  }

  .qr-wrapper {
    display: inline-block;
    background: #fff;
    padding: 10px;
    border-radius: 8px;
    line-height: 0;
  }

  .qr-img {
    width: 180px;
    height: 180px;
    display: block;
  }

  .support-note {
    margin: 12px 0 0;
    font-size: 0.75rem;
    color: var(--text-muted);
  }
</style>

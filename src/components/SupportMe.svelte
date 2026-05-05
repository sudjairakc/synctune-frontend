<script>
  import { onMount } from 'svelte'
  import { topSpenders } from '$lib/stores.js'

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080'
  const qrUrl = `${API_URL}/qr/promptpay`

  onMount(async () => {
    try {
      const res = await fetch(`${API_URL}/top-spenders`)
      if (res.ok) {
        const data = await res.json()
        topSpenders.set(data.sort((a, b) => b.amount - a.amount))
      }
    } catch {}
  })
</script>

<section class="support-section">
  <h2 class="support-title">☕ Support Me</h2>
  <p class="support-desc">ถ้าชอบ SyncTune สแกน PromptPay โอนกาแฟสักแก้วได้เลยครับ</p>
  <div class="qr-wrapper">
    <img src={qrUrl} alt="PromptPay QR" class="qr-img" />
  </div>
  <p class="support-note">PromptPay · เบอร์ 085-399-7206</p>

  {#if $topSpenders.length > 0}
    <div class="spenders-section">
      <p class="spenders-title">🏆 Top Spenders</p>
      <ul class="spenders-list">
        {#each $topSpenders as sp, i}
          <li class="spender-item" class:top1={i === 0}>
            <span class="spender-rank">
              {#if i === 0}👑{:else if i === 1}🥈{:else if i === 2}🥉{:else}{i + 1}{/if}
            </span>
            <span class="spender-name">{sp.name}</span>
            <span class="spender-amount">฿{sp.amount.toLocaleString()}</span>
          </li>
        {/each}
      </ul>
    </div>
  {/if}
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

  .spenders-section {
    margin-top: 16px;
    border-top: 1px solid var(--border);
    padding-top: 12px;
  }

  .spenders-title {
    margin: 0 0 8px;
    font-size: 0.8rem;
    font-weight: 600;
    color: var(--text-secondary);
  }

  .spenders-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .spender-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 0.8rem;
    padding: 4px 8px;
    background: var(--bg-elevated);
    border-radius: 6px;
    border: 1px solid transparent;
  }

  .spender-item.top1 {
    border-color: #f5c518;
    box-shadow: 0 0 8px 2px rgba(245, 197, 24, 0.45);
    background: linear-gradient(135deg, rgba(245, 197, 24, 0.08) 0%, var(--bg-elevated) 100%);
  }

  .spender-rank {
    width: 20px;
    font-size: 0.75rem;
    font-weight: 700;
    color: var(--text-muted);
    text-align: right;
    flex-shrink: 0;
  }

  .spender-item:nth-child(2) .spender-rank { color: #a8a9ad; }
  .spender-item:nth-child(3) .spender-rank { color: #cd7f32; }

  .spender-name {
    flex: 1;
    text-align: left;
    padding: 0 8px;
    color: var(--text-primary);
  }

  .spender-amount {
    color: var(--accent);
    font-weight: 600;
  }
</style>

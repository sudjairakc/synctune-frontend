<script>
  export let open = false;
  export let tab = 'terms'; // 'terms' | 'privacy'

  function close() { open = false; }

  function handleKeydown(e) {
    if (e.key === 'Escape') close();
  }
</script>

<svelte:window on:keydown={handleKeydown} />

{#if open}
  <!-- svelte-ignore a11y-click-events-have-key-events -->
  <!-- svelte-ignore a11y-no-static-element-interactions -->
  <div class="overlay" on:click|self={close}>
    <div class="modal" role="dialog" aria-modal="true" aria-label={tab === 'terms' ? 'Terms of Service' : 'Privacy Policy'}>
      <div class="modal-header">
        <div class="tabs">
          <button class="tab-btn" class:active={tab === 'terms'} on:click={() => tab = 'terms'}>Terms of Service</button>
          <button class="tab-btn" class:active={tab === 'privacy'} on:click={() => tab = 'privacy'}>Privacy Policy</button>
        </div>
        <button class="close-btn" on:click={close} aria-label="Close">✕</button>
      </div>

      <div class="modal-body">
        {#if tab === 'terms'}
          <h2>Terms of Service</h2>
          <p class="updated">Last updated: April 17, 2026</p>

          <h3>1. Acceptance of Terms</h3>
          <p>By accessing or using SyncTune ("the Service"), you agree to be bound by these Terms of Service. If you do not agree, please do not use the Service.</p>

          <h3>2. Description of Service</h3>
          <p>SyncTune is a collaborative music listening platform that allows users to create shared rooms, add YouTube videos to a queue, and listen in sync with others in real time.</p>

          <h3>3. User Conduct</h3>
          <p>You agree not to use the Service to:</p>
          <ul>
            <li>Share content that infringes third-party intellectual property rights</li>
            <li>Harass, abuse, or harm other users</li>
            <li>Attempt to disrupt or overload the Service infrastructure</li>
            <li>Use automated bots or scripts to interact with the Service</li>
          </ul>

          <h3>4. YouTube Content</h3>
          <p>SyncTune uses the YouTube IFrame API to play videos. All video content is subject to YouTube's Terms of Service. We do not host, store, or redistribute any video content. By using this Service you also agree to <a href="https://www.youtube.com/t/terms" target="_blank" rel="noopener noreferrer">YouTube's Terms of Service</a>.</p>

          <h3>5. Disclaimer of Warranties</h3>
          <p>The Service is provided "as is" without warranties of any kind. We do not guarantee uninterrupted or error-free operation.</p>

          <h3>6. Limitation of Liability</h3>
          <p>To the maximum extent permitted by law, SyncTune and its developers shall not be liable for any indirect, incidental, or consequential damages arising from your use of the Service.</p>

          <h3>7. Changes to Terms</h3>
          <p>We may update these Terms at any time. Continued use of the Service after changes constitutes acceptance of the revised Terms.</p>

          <h3>8. Contact</h3>
          <p>Questions about these Terms? Contact us at <a href="mailto:jainch24@gmail.com">jainch24@gmail.com</a>.</p>

        {:else}
          <h2>Privacy Policy</h2>
          <p class="updated">Last updated: April 17, 2026</p>

          <h3>1. Information We Collect</h3>
          <p>SyncTune collects only the minimum data necessary to provide the Service:</p>
          <ul>
            <li><strong>Username & profile image URL</strong> — entered by you at room join, used only for display to other users in the same room</li>
            <li><strong>Room activity</strong> — song queue, chat messages, and playback state are held in memory for the duration of your session and are not persisted to a database</li>
            <li><strong>YouTube URLs</strong> — submitted by users to add songs to the queue</li>
          </ul>

          <h3>2. Information We Do Not Collect</h3>
          <ul>
            <li>We do not require account registration or email addresses</li>
            <li>We do not use tracking cookies or analytics scripts</li>
            <li>We do not store payment information</li>
          </ul>

          <h3>3. How We Use Your Information</h3>
          <p>Data you provide is used solely to operate the real-time room features (queue sync, chat, online user list). It is not sold, shared with third parties, or used for advertising.</p>

          <h3>4. Data Retention</h3>
          <p>Session data (username, room state, chat history) is stored only in server memory and is discarded when a room is empty or the server restarts. No personal data is written to persistent storage.</p>

          <h3>5. Third-Party Services</h3>
          <p>SyncTune embeds the YouTube IFrame Player. YouTube may collect data according to <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">Google's Privacy Policy</a>. We have no control over data collected by YouTube.</p>

          <h3>6. Children's Privacy</h3>
          <p>The Service is not directed at children under 13. We do not knowingly collect information from children.</p>

          <h3>7. Changes to This Policy</h3>
          <p>We may update this Privacy Policy from time to time. The "Last updated" date at the top reflects the most recent revision.</p>

          <h3>8. Contact</h3>
          <p>Questions about this Privacy Policy? Contact us at <a href="mailto:jainch24@gmail.com">jainch24@gmail.com</a>.</p>
        {/if}
      </div>
    </div>
  </div>
{/if}

<style>
  .overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.6);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: 16px;
  }

  .modal {
    background: var(--bg-surface);
    border: 1px solid var(--border);
    border-radius: 12px;
    width: 100%;
    max-width: 620px;
    max-height: 80vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px 0;
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
  }

  .tabs {
    display: flex;
    gap: 4px;
  }

  .tab-btn {
    background: none;
    border: none;
    padding: 8px 16px;
    font-size: 14px;
    font-weight: 500;
    color: var(--text-muted);
    cursor: pointer;
    border-bottom: 2px solid transparent;
    margin-bottom: -1px;
    transition: color 0.15s, border-color 0.15s;
  }

  .tab-btn.active {
    color: var(--accent);
    border-bottom-color: var(--accent);
  }

  .tab-btn:hover:not(.active) {
    color: var(--text-secondary);
  }

  .close-btn {
    background: none;
    border: none;
    font-size: 16px;
    color: var(--text-muted);
    cursor: pointer;
    padding: 4px 8px;
    border-radius: 6px;
    transition: background 0.15s, color 0.15s;
  }

  .close-btn:hover {
    background: var(--bg-hover, rgba(128,128,128,0.15));
    color: var(--text-primary);
  }

  .modal-body {
    overflow-y: auto;
    padding: 20px 24px 24px;
    font-size: 14px;
    line-height: 1.7;
    color: var(--text-secondary);
  }

  .modal-body h2 {
    font-size: 20px;
    font-weight: 700;
    color: var(--text-primary);
    margin: 0 0 4px;
  }

  .modal-body h3 {
    font-size: 14px;
    font-weight: 600;
    color: var(--text-primary);
    margin: 20px 0 6px;
  }

  .modal-body p {
    margin: 0 0 10px;
  }

  .modal-body ul {
    margin: 0 0 10px;
    padding-left: 20px;
  }

  .modal-body li {
    margin-bottom: 4px;
  }

  .modal-body a {
    color: var(--accent);
    text-decoration: none;
  }

  .modal-body a:hover {
    text-decoration: underline;
  }

  .updated {
    font-size: 12px;
    color: var(--text-muted);
    margin-bottom: 16px !important;
  }
</style>

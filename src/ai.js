import { playSound } from './assets.js';
import { localPlayer } from './state.js';

export function interactWithNPC(npc, onClose) {
    const chatBox = document.getElementById('chat-box');
    const npcText = document.getElementById('npc-text');
    const npcName = document.getElementById('npc-name');
    const chatChoices = document.getElementById('chat-choices');
    const joystick = document.getElementById('joystick-zone');

    chatBox.style.display = 'flex'; // Changed to flex to support column layout
    if (joystick) joystick.style.display = 'none';
    
    // Determine NPC Identity
    const isShopkeeper = npc.id === 'npc_shop';
    npcName.innerText = isShopkeeper ? "Shopkeeper Cat" : "Cat";

    // Play Sound
    playSound('meow', 0.8);

    // Dialogue State Machine
    // We'll manage conversation flow locally here
    
    const closeDialogue = () => {
        chatBox.style.display = 'none';
        if (joystick) joystick.style.display = '';
        if (onClose) onClose();
    };

    const renderChoices = (choices) => {
        chatChoices.innerHTML = '';
        choices.forEach(c => {
            const btn = document.createElement('button');
            btn.className = 'chat-btn';
            btn.innerText = c.text;
            btn.onclick = (e) => {
                e.stopPropagation(); // Stop propagation to prevent accidental map clicks
                c.action();
            };
            chatChoices.appendChild(btn);
        });
    };

    const showNode = (text, choices) => {
        npcText.innerText = text;
        
        // If no choices provided, default to "Leave"
        if (!choices || choices.length === 0) {
            renderChoices([{ text: "Leave", action: closeDialogue }]);
        } else {
            renderChoices(choices);
        }
    };

    // --- Shopkeeper Logic ---
    if (isShopkeeper) {
        const hasQuest = localPlayer.quests.some(q => q.id === 'find_kittens');
        const questComplete = hasQuest && localPlayer.quests.find(q => q.id === 'find_kittens').completed;

        if (questComplete) {
            showNode("My babies! You found them! Thank you so much! I'll open the shop for you soon.", [
                { text: "You're welcome!", action: closeDialogue }
            ]);
        } else if (hasQuest) {
            showNode("Please hurry! My kittens are lost in the North and South rifts...", [
                { text: "I'm looking for them.", action: closeDialogue }
            ]);
        } else {
            // Initial Greeting
            const openShop = () => {
                showNode("I'm sorry, I can't open the shop right now. I'm too worried about my kittens.", [
                    { text: "Kittens?", action: askAboutKittens },
                    { text: "I see. Bye.", action: closeDialogue }
                ]);
            };

            const askAboutKittens = () => {
                showNode("Yes... three of them wandered off. They went into the rifts to the North and South. It's dangerous there! Could you find them for me?", [
                    { text: "I'll help find them!", action: acceptQuest },
                    { text: "Sounds dangerous. No.", action: closeDialogue }
                ]);
            };

            const acceptQuest = () => {
                // Add Quest
                localPlayer.quests.push({
                    id: 'find_kittens',
                    title: 'Lost Kittens',
                    description: 'Find the 3 lost kittens in the North and South rifts.',
                    progress: 0,
                    target: 3,
                    completed: false
                });

                // Update UI for Quests immediately
                const btnQuests = document.getElementById('btn-quests');
                if (btnQuests) btnQuests.style.display = 'block';

                showNode("Oh thank you! I'll unlock the shop once you bring them back safely.", [
                    { text: "I'm on it!", action: closeDialogue }
                ]);
            };

            showNode("Meow... Welcome to my shop. *sniff*", [
                { text: "Browse Shop", action: openShop },
                { text: "Are you okay?", action: askAboutKittens },
                { text: "Leave", action: closeDialogue }
            ]);
        }
    } else {
        // Generic NPC Fallback
        const phrases = ["Meow.", "Prrrt?", "Need something?"];
        showNode(phrases[Math.floor(Math.random() * phrases.length)], []);
    }
}

export function closeChat() {
    const chatBox = document.getElementById('chat-box');
    const joystick = document.getElementById('joystick-zone');
    if (chatBox) chatBox.style.display = 'none';
    if (joystick) joystick.style.display = '';
}
import { load } from 'js-yaml';
import { marked } from 'marked';

async function loadContent() {
  const bookElement = document.querySelector('[data-book]');
  if (!bookElement) return;

  const bookName = bookElement.getAttribute('data-book');
  // Adjust path if running locally vs production if needed, but relative path '../content' should work from '/pages/'
  // Note: Dev server serves root at /, so pages are at /pages/x.html and content is at /content/x.md.
  // Fetching '../content/x.md' from 'pages/x.html' resolves to '/content/x.md'. Correct.
  const contentUrl = `../content/${bookName}.md`; 

  try {
    const response = await fetch(contentUrl);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const text = await response.text();

    // Parse Frontmatter
    const parts = text.split(/^---$/m);
    if (parts.length < 3) return; // Invalid format

    const frontmatter = parts[1];
    const body = parts.slice(2).join('---');

    const meta = load(frontmatter);
    const descriptionHtml = marked.parse(body);

    // Update Title
    const titleEl = document.getElementById('book-title');
    if (titleEl && meta.title) titleEl.innerText = meta.title;

    // Update Stats
    const statsContainer = document.getElementById('book-stats');
    if (statsContainer && meta.stats) {
      statsContainer.innerHTML = meta.stats.map(stat => `
        <div class="flex flex-col items-center justify-center bg-muted/50 rounded-lg border border-border p-2 md:p-4 h-full lg:w-32 lg:h-32">
          <i data-lucide="${stat.icon}" class="w-8 h-8 md:w-16 md:h-16 mb-2 text-primary"></i>
          <div class="flex items-center justify-center h-full text-[0.65rem] sm:text-sm text-center font-medium leading-tight">${stat.text}</div>
        </div>
      `).join('');
    }

    // Update Description
    const descContainer = document.getElementById('book-description');
    if (descContainer) {
       descContainer.innerHTML = `
          <div class="text-muted-foreground text-sm leading-relaxed prose prose-sm dark:prose-invert max-w-none">
            ${descriptionHtml}
          </div>
       `;
    }

    // Update Index
    const indexContainer = document.getElementById('book-index-list');
    if (indexContainer && meta.chapters) {
       indexContainer.innerHTML = meta.chapters.map(chapter => {
           const hasDesc = chapter.description && chapter.description.trim() !== "";
           
           // Helper to parse description
           const parseDescription = (desc, chapterNum) => {
              if (!desc) return "";
              
              // Clean chapter number (remove leading zeros for cleaner look like 1.1 instead of 01.1)
              let mainNum = chapterNum;
              if (/^\d+$/.test(mainNum)) {
                  mainNum = parseInt(mainNum, 10);
              }

              const lines = desc.split('\n');
              let counters = [0, 0]; // Level 1, Level 2
              
              return lines.map(line => {
                  line = line.trim();
                  if (!line) return "";
                  
                  if (line.startsWith('-R ')) {
                      // Summary/Review Item: R[ChapterNum]
                      const numStr = `R${mainNum}`;
                      const text = marked.parseInline(line.substring(3));
                      return `<div class="flex items-baseline gap-2 mt-2 first:mt-0">
                                <span class="font-mono font-bold text-muted-foreground text-xs whitespace-nowrap">${numStr}</span>
                                <span class="text-sm leading-relaxed">${text}</span>
                              </div>`;
                  } else if (line.startsWith('-- ')) {
                      // Level 2
                      counters[1]++;
                      const numStr = `${mainNum}.${counters[0]}.${counters[1]}`;
                      const text = marked.parseInline(line.substring(3));
                      // Indented
                      return `<div class="flex items-baseline gap-2 ml-4 mt-1">
                                <span class="font-mono font-bold text-muted-foreground text-xs whitespace-nowrap">${numStr}</span>
                                <span class="text-sm leading-relaxed">${text}</span>
                              </div>`;
                  } else if (line.startsWith('- ')) {
                      // Level 1
                      counters[0]++;
                      counters[1] = 0; // Reset level 2
                      const numStr = `${mainNum}.${counters[0]}`;
                      const text = marked.parseInline(line.substring(2));
                      return `<div class="flex items-baseline gap-2 mt-2 first:mt-0">
                                <span class="font-mono font-bold text-muted-foreground text-xs whitespace-nowrap">${numStr}</span>
                                <span class="text-sm leading-relaxed">${text}</span>
                              </div>`;
                  } else {
                      // Plain text fallback (optional, if mixed content)
                      return `<div class="mt-2 text-sm leading-relaxed">${marked.parseInline(line)}</div>`;
                  }
              }).join('');
           };

           const descriptionHtml = hasDesc ? parseDescription(chapter.description, chapter.number) : "";

           // Page number logic
           const hasPage = chapter.page && chapter.page.trim() !== "";
           const pageHtml = hasPage 
             ? `<div class="hidden md:flex flex-col pt-5 pl-4 text-left">
                  <span class="text-sm font-medium text-muted-foreground/60 group-hover:text-muted-foreground transition-colors">${chapter.page}</span>
                </div>`
             : `<div class="hidden md:block"></div>`; // spacer to keep grid consistent if needed, or just let it collapse

           const contentHtml = hasDesc 
             ? `<details class="peer group/details bg-card border border-border rounded-lg shadow-sm open:shadow-md transition-all" name="index">
                    <summary class="list-none cursor-pointer p-4 md:p-5 flex items-center justify-between font-semibold text-lg select-none hover:bg-muted/50 rounded-lg transition-colors">
                       <span class="text-base md:text-lg">${chapter.title}</span>
                        <i data-lucide="chevron-down" class="w-5 h-5 transition-transform group-open/details:rotate-180 text-muted-foreground"></i>
                    </summary>
                    <div class="p-4 md:p-5 pt-0 text-muted-foreground border-t border-border/50 mt-0">
                       <div class="mt-2 text-sm leading-relaxed text-foreground/80 space-y-1">
                          ${descriptionHtml}
                       </div>
                    </div>
                 </details>`
             : `<div class="peer group/details bg-card border border-border rounded-lg shadow-sm transition-all">
                    <div class="p-4 md:p-5 flex items-center justify-between font-semibold text-lg select-none hover:bg-muted/50 rounded-lg transition-colors">
                       <span class="text-base md:text-lg">${chapter.title}</span>
                    </div>
                 </div>`;

           return `
         <div class="group relative grid grid-cols-[2.5rem_1fr] md:grid-cols-[5rem_1fr_4rem] gap-3 md:gap-8 mb-8">
             <div class="text-right pt-5 pr-2 md:pr-8">
                 <span class="hidden md:inline text-lg md:text-2xl font-bold font-mono text-muted-foreground group-hover:text-primary transition-colors">${chapter.number}</span>
             </div>
             <div class="relative pl-4">
                 ${contentHtml}
                 <div class="absolute -left-[1.875rem] md:-left-[3.125rem] top-4 w-9 h-9 rounded-full bg-background border-2 border-muted text-muted-foreground flex items-center justify-center z-10 shadow-sm transition-all duration-300 group-hover:scale-110 group-hover:!border-primary group-hover:!text-primary peer-open:!border-primary peer-open:!text-primary">
                     <i data-lucide="${chapter.icon}" class="w-4 h-4"></i>
                 </div>
             </div>
             ${pageHtml}
         </div>
           `;
       }).join('');
    }

    // Refresh Icons (Lucide is global)
    if (window.lucide) {
      window.lucide.createIcons();
    }

  } catch (err) {
    console.error('Failed to load content', err);
  }
}

document.addEventListener('DOMContentLoaded', () => {
    loadContent();
    new ThemeManager();
    new FooterRenderer();
    new HeroAnimator();
});

// ... existing classes ...

class HeroAnimator {
    constructor() {
        this.canvas = document.getElementById('hero-canvas');
        if (!this.canvas) return;
        
        this.ctx = this.canvas.getContext('2d');
        
        this.snippets = [
    'print("Benvenuto, Niccolò! Inizia il tuo viaggio con Python per principianti.")',
    '# Programmazione per principianti: il tuo primo commento\nprint("Hello, World!")',
    'help(print)  # Scopri come funzionano i comandi base',
    'nome = "Niccolò"\neta = 23\nprint(f"Nome: {nome}, Età: {eta}")',
    'x = 10\ny = 3\nprint(f"Somma: {x + y}, Divisione: {x / y}")',
    'costante_pigreco = 3.14159\nprint(round(costante_pigreco, 2))',
    'tipo_dato = type(42)\nprint(f"Il tipo di 42 è: {tipo_dato}")',
    'voto = 28\nif voto >= 18:\n    print("Esame superato!")',
    'n = 10\nprint("Pari" if n % 2 == 0 else "Dispari")',
    'punteggio = 85\nif punteggio > 90:\n    print("Ottimo")\nelif punteggio > 70:\n    print("Buono")\nelse:\n    print("Sufficiente")',
    'is_ready = True\nif is_ready:\n    print("Niccolò è pronto a programmare.")',
    'for i in range(5):\n    print(f"Capitolo {i}: Fondamentali")',
    'contatore = 3\nwhile contatore > 0:\n    print(contatore)\n    contatore -= 1',
    '[print(x) for x in "Python"] # List comprehension per iterare',
    'def saluta(utente):\n    return f"Ciao {utente}, benvenuto in Nannucci Lab!"\nprint(saluta("Niccolò"))',
    'def area_cerchio(raggio, pi=3.14):\n    return pi * (raggio ** 2)',
    'quadrato = lambda x: x * x\nprint(quadrato(5))',
    'corso = "Python per principianti"\nprint(corso.upper())',
    'testo = "  Spazi inutili  "\nprint(testo.strip())',
    's = "Mela,Banana,Pera"\nlista_frutta = s.split(",")',
    'numeri = [1, 2, 3, 4]\nnumeri.append(5)\nprint(numeri)',
    'frutta = ["mela", "pera"]\nfrutta.insert(1, "banana")',
    'quadrati = [x**2 for x in range(10)]\nprint(quadrati)',
    'coordinate = (45.07, 7.68) # Coordinate di Torino\nlat, lon = coordinate',
    'tupla_singola = (10,)\nprint(type(tupla_singola))',
    'colori_rgb = ("rosso", "verde", "blu")\nprint(colori_rgb[0])',
    'numeri_unici = {1, 2, 2, 3, 3}\nprint(numeri_unici) # Rimuove duplicati',
    'set_a = {1, 2, 3}\nset_b = {3, 4, 5}\nprint(set_a.union(set_b))',
    'set_a.intersection(set_b) # Trova elementi comuni',
    'studente = {"nome": "Niccolò", "corso": "Ing. Informatica"}\nprint(studente["nome"])',
    'voti = {"Analisi": 28, "Chimica": 24}\nvoti["Python"] = 30',
    'print(voti.get("Geometria", "Esame non dato"))',
    'class Studente:\n    def __init__(self, nome):\n        self.nome = nome\ns1 = Studente("Niccolò")',
    'class Libro:\n    autore = "Nannucci"\n    def __init__(self, titolo):\n        self.titolo = titolo',
    'class Rettangolo:\n    def __init__(self, b, h):\n        self.area = b * h',
    'class Cane:\n    def verso(self):\n        return "Bau!"\nfido = Cane()',
    'try:\n    risultato = 10 / 0\nexcept ZeroDivisionError:\n    print("Non puoi dividere per zero!")',
    'try:\n    n = int("testo")\nexcept ValueError:\n    print("Conversione fallita")',
    'finally:\n    print("Operazione conclusa (con o senza errori).")',
    'with open("note.txt", "w") as f:\n    f.write("Niccolò sta imparando Python.")',
    'with open("note.txt", "r") as f:\n    contenuto = f.read()',
    'import os\nif os.path.exists("note.txt"):\n    print("Il file esiste!")',
    'class Nodo:\n    def __init__(self, val):\n        self.val = val\n        self.left = None\n        self.right = None',
    'root = Nodo(10)\nroot.left = Nodo(5)\nroot.right = Nodo(15)',
    'def stampa_inorder(nodo):\n    if nodo:\n        stampa_inorder(nodo.left)\n        print(nodo.val)\n        stampa_inorder(nodo.right)',
    'def conta_nodi(nodo):\n    if not nodo: return 0\n    return 1 + conta_nodi(nodo.left) + conta_nodi(nodo.right)',
    'def bubble_sort(lista):\n    n = len(lista)\n    for i in range(n):\n        for j in range(0, n-i-1):\n            if lista[j] > lista[j+1]:\n                lista[j], lista[j+1] = lista[j+1], lista[j]',
    'def ricerca_lineare(lista, x):\n    for i in range(len(lista)):\n        if lista[i] == x: return i\n    return -1',
    'def fattoriale(n):\n    return 1 if n == 0 else n * fattoriale(n-1)',
    'fib = lambda n: n if n <= 1 else fib(n-1) + fib(n-2)\n# Calcola Fibonacci ricorsivamente'
];
        
        this.instances = [];
        this.resize(); // Init config
        
        // Init loop
        this.loop = this.loop.bind(this);
        this.resize = this.resize.bind(this);
        
        window.addEventListener('resize', this.resize);
        requestAnimationFrame(this.loop);
    }
    
    resize() {
        if (!this.canvas || !this.canvas.parentElement) return;
        
        this.width = this.canvas.parentElement.offsetWidth;
        this.height = this.canvas.parentElement.offsetHeight;
        this.canvas.width = this.width;
        this.canvas.height = this.height;
        
        // Responsive Configuration
        if (this.width < 768) {
            this.maxInstances = 2; // Reduced on mobile
            this.fontSize = 11;
        } else if (this.width < 1024) {
            this.maxInstances = 3;
            this.fontSize = 12;
        } else {
            this.maxInstances = 5;
            this.fontSize = 14;
        }
        
        // Re-initialize if count changed significantly or just trim
        // If we have too many, trim. If too few, add.
        
        while (this.instances.length > this.maxInstances) {
            this.instances.pop();
        }
        
        while (this.instances.length < this.maxInstances) {
            const inst = this.createInstance(this.instances.length * 500);
            if (inst) this.instances.push(inst);
            else break;
        }
    }
    
    createInstance(delay = 0, retryCount = 0) {
        if (retryCount > 15) return null; 
        
        const lineHeight = this.fontSize * 1.5;
        // Estimate width based on font
        const estimatedWidth = this.fontSize * 25; // Roughly 25 chars
        const estimatedHeight = this.fontSize * 5; // Roughly 5 lines
        
        // Ensure strictly positive range
        const maxX = Math.max(0, this.width - estimatedWidth - 10);
        const maxY = Math.max(0, this.height - estimatedHeight - 10);
        
        const x = Math.random() * maxX + 5;
        const y = Math.random() * maxY + 5;
        
        // Collision Check
        const overlap = this.instances.some(inst => {
            return (x < inst.x + inst.w &&
                    x + estimatedWidth > inst.x &&
                    y < inst.y + inst.h &&
                    y + estimatedHeight > inst.y);
        });
        
        if (overlap) {
            return this.createInstance(delay, retryCount + 1);
        }
        
        return {
            x, y,
            w: estimatedWidth, h: estimatedHeight,
            snippetIndex: Math.floor(Math.random() * this.snippets.length),
            currentText: '',
            isDeleting: false,
            nextActionTime: Date.now() + delay,
            cursorVisible: true,
            cursorTimer: 0,
            typingSpeed: 60 + Math.random() * 40,
            deletingSpeed: 30,
            pauseTime: 2000 + Math.random() * 1000
        };
    }
    
    loop() {
        const now = Date.now();
        if (!this.lastTime) this.lastTime = now;
        const deltaTime = now - this.lastTime;
        this.lastTime = now;
        
        this.ctx.clearRect(0, 0, this.width, this.height);
        
        const isDark = document.documentElement.classList.contains('dark');
        
        this.instances.forEach((inst, index) => {
            this.updateInstance(inst, now, deltaTime);
            this.drawInstance(inst, isDark);
        });
        
        requestAnimationFrame(this.loop);
    }
    
    updateInstance(inst, now, deltaTime) {
        inst.cursorTimer += deltaTime;
        if (inst.cursorTimer > 500) {
            inst.cursorVisible = !inst.cursorVisible;
            inst.cursorTimer = 0;
        }

        if (now > inst.nextActionTime) {
             const targetText = this.snippets[inst.snippetIndex];
             
             if (inst.isDeleting) {
                 inst.currentText = targetText.substring(0, inst.currentText.length - 1);
                 if (inst.currentText === '') {
                     // Respawn
                     const newInst = this.createInstance(200);
                     if (newInst) {
                         Object.assign(inst, newInst);
                     } else {
                         // Wait if blocked
                         inst.nextActionTime = now + 500;
                     }
                 } else {
                     inst.nextActionTime = now + inst.deletingSpeed;
                 }
             } else {
                 if (inst.currentText === targetText) {
                     inst.isDeleting = true;
                     inst.nextActionTime = now + inst.pauseTime;
                 } else {
                     inst.currentText = targetText.substring(0, inst.currentText.length + 1);
                     inst.nextActionTime = now + inst.typingSpeed + (Math.random() * 30);
                 }
             }
        }
    }
    
    drawInstance(inst, isDark) {
        const fontFamily = 'monospace'; 
        this.ctx.font = `${this.fontSize}px ${fontFamily}`;
        
        const colors = {
            base: isDark ? '#ffffff' : '#1e293b', 
            keyword: isDark ? '#d8b4fe' : '#9333ea', 
            string: isDark ? '#4ade80' : '#16a34a', 
            literal: isDark ? '#60a5fa' : '#2563eb', 
            comment: isDark ? '#94a3b8' : '#64748b', 
            cursor: isDark ? '#ffffff' : '#1e293b'
        };

        const lines = inst.currentText.split('\n');
        const lineHeight = this.fontSize * 1.5;
        
        lines.forEach((line, index) => {
            const y = inst.y + (index * lineHeight);
            let x = inst.x;
            
            // Syntax Highlighting
            const parts = line.split(/(".*?"|'.*?'|#.*|\bdef\b|\bprint\b|\bif\b|\belif\b|\belse\b|\breturn\b|\bclass\b|\bpublic\b|\bstatic\b|\bvoid\b|\bconst\b|\bvar\b|\blet\b|\bSELECT\b|\bFROM\b|\bWHERE\b|\bTrue\b|\bFalse\b|\bNone\b|\b\d+\b)/g);
            
            parts.forEach(part => {
                if (!part) return;
                
                if (part.startsWith('"') || part.startsWith("'")) this.ctx.fillStyle = colors.string;
                else if (part.startsWith('#') || part.startsWith('//')) this.ctx.fillStyle = colors.comment;
                else if (part.match(/\b(def|print|if|elif|else|return|class|public|static|void|const|var|let|SELECT|FROM|WHERE)\b/)) this.ctx.fillStyle = colors.keyword;
                else if (part.match(/\b(True|False|None|\d+)\b/)) this.ctx.fillStyle = colors.literal;
                else this.ctx.fillStyle = colors.base;
                
                this.ctx.fillText(part, x, y);
                x += this.ctx.measureText(part).width;
            });
            
            if (index === lines.length - 1 && inst.cursorVisible) {
                this.ctx.fillStyle = colors.cursor;
                this.ctx.fillRect(x + 2, y - this.fontSize + (this.fontSize*0.3), 8, this.fontSize); 
            }
        });
    }
}

// ... existing ThemeManager code ...

class FooterRenderer {
    constructor() {
        this.init();
    }

    init() {
        // Determine base path
        const isPagesDir = window.location.pathname.includes('/pages/');
        const rootPath = isPagesDir ? '../' : './';
        
        // Define links dynamically
        const pythonLink = `${rootPath}pages/python_per_principianti.html`;
        const javaLink = `${rootPath}pages/java_per_principianti.html`;
        
        const footerHTML = `
        <div class="container mx-auto px-4 md:px-6 py-12">
            <div class="grid grid-cols-1 md:grid-cols-3 gap-8 text-center md:text-left">
            
            <!-- Brand / Info -->
            <div class="flex flex-col items-center md:items-start space-y-4">
                <div class="flex items-center space-x-2">
                    <span class="font-bold text-lg">Programmazione per principianti</span>
                </div>
                <p class="text-sm text-muted-foreground leading-relaxed max-w-xs">
                Guide chiare, pratiche e complete per iniziare il tuo viaggio nel mondo del codice. Dalla teoria alla pratica, passo dopo passo.
                </p>
            </div>

            <!-- Links -->
            <div class="flex flex-col items-center md:items-start space-y-4">
                <h4 class="font-semibold text-foreground">Libri</h4>
                <ul class="space-y-2 text-sm text-muted-foreground">
                <li><a href="${pythonLink}" class="hover:text-primary transition-colors">Python per principianti</a></li>
                <li><a href="${javaLink}" class="hover:text-primary transition-colors">Java per principianti</a></li>
                </ul>
            </div>

            <!-- Contact -->
            <div class="flex flex-col items-center md:items-start space-y-4">
                <h4 class="font-semibold text-foreground">Contatti</h4>
                <a href="mailto:nannucci.books@gmail.com" class="text-sm text-muted-foreground hover:text-primary transition-colors flex items-center gap-2">
                <i data-lucide="mail" class="h-4 w-4"></i> nannucci.books@gmail.com
                </a>
            </div>

            </div>

            <div class="border-t border-border mt-12 pt-8 text-center text-xs text-muted-foreground flex flex-col items-center gap-2">
            <p>&copy; 2025-2026 Niccolò Nannucci. Tutti i diritti riservati.</p>
            <p>Realizzato con ❤️ e codice.</p>
            </div>
        </div>
        `;

        const footerPlaceholder = document.getElementById('main-footer');
        if (footerPlaceholder) {
            footerPlaceholder.innerHTML = footerHTML;
            footerPlaceholder.classList.add('bg-muted/30', 'border-t', 'border-border', 'mt-auto');
            
            // Re-run Lucide to render icons in the new footer
            if (window.lucide) {
                window.lucide.createIcons();
            }
        }
    }
}

class ThemeManager {
    constructor() {
        this.theme = localStorage.getItem('theme') || 'system';
        // Ensure valid theme
        if (!['light', 'dark', 'system'].includes(this.theme)) {
            this.theme = 'system';
        }
        this.init();
    }

    init() {
        this.applyTheme();
        this.updateActiveState();

        // System Theme Listener - keep this to detect OS changes live
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
            if (this.theme === 'system') {
                this.applyTheme();
            }
        });
        
        // UI Listeners
        document.addEventListener('click', (e) => {
            const toggleBtn = e.target.closest('[data-theme-toggle]');
            if (toggleBtn) {
                const newTheme = toggleBtn.getAttribute('data-theme-toggle');
                this.setTheme(newTheme);
            }
            
            // Dropdown visibility
            const trigger = e.target.closest('#theme-trigger');
            if (trigger) {
                const menu = document.getElementById('theme-menu');
                menu.classList.toggle('hidden');
            } else if (!e.target.closest('#theme-menu')) {
                document.getElementById('theme-menu')?.classList.add('hidden');
            }
        });
    }

    setTheme(newTheme) {
        if (!['light', 'dark', 'system'].includes(newTheme)) return;
        
        console.log(`Setting theme to: ${newTheme}`);
        this.theme = newTheme;
        localStorage.setItem('theme', newTheme);
        this.applyTheme();
        this.updateActiveState();
    }

    applyTheme() {
        let isDark;
        if (this.theme === 'system') {
            const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            isDark = systemDark;
            console.log(`System theme detected: ${systemDark ? 'Dark' : 'Light'}`);
        } else {
            isDark = this.theme === 'dark';
        }

        console.log(`Applying Visuals: ${isDark ? 'Dark' : 'Light'}`);
        if (isDark) {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
    }

    updateActiveState() {
        // Update checkmarks in dropdown
        document.querySelectorAll('[data-theme-toggle]').forEach(btn => {
            const theme = btn.getAttribute('data-theme-toggle');
            if (theme === this.theme) {
                btn.classList.add('bg-accent', 'text-accent-foreground');
            } else {
                btn.classList.remove('bg-accent', 'text-accent-foreground');
            }
        });

        // Update Trigger Icon - targeting hidden spans that wrap Lucide icons
        const trigger = document.getElementById('theme-trigger');
        if (trigger) {
            const lightWrapper = trigger.querySelector('[data-theme-icon="light"]');
            const darkWrapper = trigger.querySelector('[data-theme-icon="dark"]');
            const systemWrapper = trigger.querySelector('[data-theme-icon="system"]');

            // Reset all: hide and scale down
            [lightWrapper, darkWrapper, systemWrapper].forEach(el => {
                if (el) el.classList.add('scale-0', 'hidden');
            });

            // Activate specific one: show and scale up
            if (this.theme === 'system') {
                if (systemWrapper) systemWrapper.classList.remove('scale-0', 'hidden'); 
            } else if (this.theme === 'dark') {
                if (darkWrapper) darkWrapper.classList.remove('scale-0', 'hidden');
            } else {
                if (lightWrapper) lightWrapper.classList.remove('scale-0', 'hidden');
            }
        }
    }
}

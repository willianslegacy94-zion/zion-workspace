Essa integração é o verdadeiro "pulo do gato" para quem gerencia um produto SaaS. Ter a documentação técnica no Obsidian conversando diretamente com o Claude poupa um tempo absurdo, porque você não precisa ficar contextualizando o modelo de dados ou as regras de comissão a cada comando.

Aqui está o passo a passo prático de como colocar as duas ferramentas para trabalharem juntas no seu dia a dia:

## 🛠️ Método 1: A forma nativa e mais rápida (Claude Code via Terminal)

Se você já utiliza o **Claude Code** (a ferramenta de terminal da Anthropic), a integração é orgânica. O Claude Code lê os arquivos locais do diretório em que ele foi iniciado.

1. **Coloque a documentação no seu projeto:** Crie uma pasta chamada `docs/` ou `.obsidian-docs/` direto na raiz do projeto do seu sistema (na mesma pasta onde ficam as pastas `backend/` e `frontend/`).
    
2. **Abra o Obsidian apontando para essa pasta:** No aplicativo do Obsidian, selecione "Abrir pasta como cofre" (_Open folder as vault_) e escolha essa pasta que você criou dentro do projeto.
    
3. **Como usar na prática:** Quando você iniciar o Claude Code no terminal da sua máquina ou VPS, basta puxar o contexto da nota usando comandos naturais.
    

> **Exemplo de comando no terminal:** _"Claude, leia as regras de comissão na nossa nota `docs/03 - Inteligência Financeira e Regras de Negócio.md` e verifique se o arquivo `backend/routes/vendas.js` está aplicando os 40% corretamente."_

O Claude abrirá o arquivo do Obsidian, lerá a regra técnica que documentamos e fará o pente fino no código fonte na hora.

## 🔌 Método 2: Interface Visual (Claude de carona dentro do Obsidian)

Se você prefere programar ou gerenciar o negócio olhando para o aplicativo visual do Obsidian e quer um chat do Claude na barra lateral para te ajudar a criar queries, regras ou analisar o sistema, use o plugin **Smart Connections** ou o **BMO Chatbot**.

### Passo a Passo de Configuração:

1. No Obsidian, vá em **Configurações** (ícone de engrenagem no canto inferior esquerdo).
    
2. Clique em **Plugins da comunidade** (_Community Plugins_) e clique em **Ativar**.
    
3. Clique em **Procurar** (_Browse_) e digite `Smart Connections` ou `BMO Chatbot`. Instale e ative o plugin.
    
4. Vá nas configurações do plugin instalado. Ele vai te pedir uma **API Key**.
    
5. **Gerando a chave:** Acesse o [Console da Anthropic](https://console.anthropic.com/), crie uma conta (se não tiver), vá em _API Keys_, gere uma nova chave segura e cole dentro do campo no Obsidian.
    
6. **O superpoder do plugin:** O _Smart Connections_, por exemplo, faz uma leitura (_embedding_) de todas as suas notas. Você abre o chat dele na lateral e digita:
    
    > _"Com base na minha nota de banco de dados, me crie o comando SQL para cadastrar um novo agendamento físico para a unidade Mutinga."_ Ele lerá seu arquivo `.md` do banco e te dará o código SQL perfeito, mastigado.
    

## 💡 Dica de Ouro para Organização

Mantenha a nomenclatura das notas exatamente como estruturamos no passo anterior (`01 - ...`, `02 - ...`). Índices numéricos ajudam tanto o Obsidian no mapa visual quanto o modelo do Claude a entender a hierarquia das suas regras de negócio.


[[perfil-eu-dissimulado]]
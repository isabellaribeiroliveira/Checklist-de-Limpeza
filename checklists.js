/*
 * Modelos de checklist (REG-UTL-176). Os locais de cada coluna vêm do cronograma:
 *   locais: 'garagem' → só a garagem da filial
 *           'pontos'  → só os pontos de apoio programados no ciclo
 *           'todos'   → garagem + pontos de apoio programados
 * Itens com "outros: true" começam como "Não aplicável" e pedem descrição quando avaliados.
 * Itens com "Uniforme" ou "EPI" no nome entram nas notas de Apresentação e EPI.
 */
const OUTROS = { nome: 'Outros (caso aplicável)', outros: true };

window.CHECKLISTS = {
  geral: {
    titulo: 'Geral Veículo',
    resumo: 'Limpeza geral na garagem, mínimo de 3 carros',
    tipo: 'veiculo', locais: 'garagem', min: 3,
    regra: 'Inspecione no mínimo 3 carros na garagem.',
    secoes: [
      { nome: 'Exterior', itens: [
        { nome: 'Para-brisa' }, { nome: 'Retrovisores' }, { nome: 'Laterais' }, { nome: 'Rodas e Pneus' },
        { nome: 'Degraus das Portas' }, OUTROS ] },
      { nome: 'Interior', itens: [
        { nome: 'Cinto de Segurança (se aplicável)' }, { nome: 'Painel' }, { nome: 'Capô' }, { nome: 'Cortina' },
        { nome: 'Quebra-sol' }, { nome: 'Assoalho (degraus e piso)' }, { nome: 'Poltronas' }, { nome: 'Vidros' },
        { nome: 'Estrutura da Janela (vidros e borrachas)' }, { nome: 'Borracha' }, { nome: 'Teto' },
        { nome: 'Fórmicas (estrutura e frisos laterais)' }, { nome: 'Frisos Laterais' }, { nome: 'Corrimão' },
        { nome: 'Balaústres' }, { nome: 'Roleta' }, { nome: 'Gaveta do Cobrador/Motorista' },
        { nome: 'Tampa do Pistão Porta Dianteira' }, { nome: 'Tampa do Pistão Porta Traseira' },
        { nome: 'Portas (vidros e borrachas)' }, { nome: 'Porta-pacote' }, { nome: 'Atrás dos pedais' },
        { nome: 'Odor do Veículo' }, { nome: 'Bolsa de documentos' }, OUTROS ] },
      { nome: 'Segurança', itens: [{ nome: 'Extintor' }, OUTROS] },
      { nome: 'Equipe', itens: [{ nome: 'Uniforme e Higiene Pessoal' }, { nome: 'Uso de EPIs' }, OUTROS] }
    ]
  },

  predial_garagem: {
    titulo: 'Predial Garagem',
    resumo: 'Áreas administrativas, operacionais e instalações da garagem',
    tipo: 'local', locais: 'garagem',
    regra: 'Avalie todas as áreas da garagem. Use "Não aplicável" para áreas que não existem nesta filial.',
    secoes: [
      { nome: 'Áreas administrativas', itens: [
        { nome: 'Portaria' }, { nome: 'Bloco Financeiro' }, { nome: 'Bloco Gerência' }, { nome: 'Setor de Fretamentos' },
        { nome: 'Departamento Pessoal/RH' }, { nome: 'Auditório/Ponto' }, { nome: 'SESMT' }, OUTROS ] },
      { nome: 'Áreas operacionais', itens: [
        { nome: 'Pátio' }, { nome: 'Estacionamento' }, { nome: 'Manutenção' }, { nome: 'Caixa separadora' },
        { nome: 'Canaletas' }, { nome: 'Suprimentos' }, { nome: 'Lava-jato' }, { nome: 'Lavador de Chassi' },
        { nome: 'Bomba de Abastecimento' }, OUTROS ] },
      { nome: 'Instalações', itens: [{ nome: 'Banheiros' }, OUTROS] },
      { nome: 'Equipe', itens: [{ nome: 'Uniforme e Higiene Pessoal' }, { nome: 'Uso de EPIs' }] }
    ]
  },

  predial_pa: {
    titulo: 'Predial Ponto de Apoio',
    resumo: 'Pontos de apoio programados neste ciclo',
    tipo: 'local', locais: 'pontos',
    regra: 'Avalie cada ponto de apoio programado neste ciclo.',
    secoes: [
      { nome: 'Áreas operacionais', itens: [
        { nome: 'Pátio do Ponto de Apoio' }, { nome: 'Salas do Ponto de Apoio' }, { nome: 'Estacionamento' },
        { nome: 'Lava-jato' }, { nome: 'Lavador de Chassi' }, OUTROS ] },
      { nome: 'Instalações', itens: [{ nome: 'Banheiro' }, OUTROS] },
      { nome: 'Equipe', itens: [{ nome: 'Uniforme e Higiene Pessoal' }, { nome: 'Uso de EPIs' }] }
    ]
  },

  parcial: {
    titulo: 'Parcial Veículo',
    resumo: 'Limpeza parcial, 3 carros em cada local',
    tipo: 'veiculo', locais: 'todos', min: 3,
    regra: 'Inspecione no mínimo 3 carros em cada local: garagem e pontos de apoio programados.',
    secoes: [
      { nome: 'Exterior', itens: [{ nome: 'Para-brisa' }, { nome: 'Laterais da carroceria' }, OUTROS] },
      { nome: 'Interior', itens: [
        { nome: 'Assoalho (degraus e piso)' }, { nome: 'Painel' }, { nome: 'Capô' }, { nome: 'Poltronas' },
        { nome: 'Estrutura da Janela (vidros e borrachas)' }, { nome: 'Frisos Laterais Internos' }, { nome: 'Corrimão' },
        { nome: 'Fórmicas (estrutura e frisos laterais)' }, { nome: 'Borracha' }, { nome: 'Portas (vidros e borrachas)' },
        { nome: 'Odor do Veículo Rodoviário' }, { nome: 'Gaveta do Cobrador/Motorista' },
        { nome: 'Tampa do Pistão Porta Dianteira' }, { nome: 'Tampa do Pistão Porta Traseira' }, { nome: 'Roleta' },
        { nome: 'Bolsa de documentos' }, { nome: 'Atrás dos pedais' }, OUTROS ] },
      { nome: 'Segurança', itens: [{ nome: 'Extintor' }, OUTROS] },
      { nome: 'Equipe', itens: [{ nome: 'Uniforme e Higiene Pessoal' }, { nome: 'Uso de EPIs' }, OUTROS] }
    ]
  }
};

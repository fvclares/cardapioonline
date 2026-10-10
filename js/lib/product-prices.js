// Administrative input: empty is not offered; malformed input is never deletion.
// fields: [{id, active, value, fixed?}] — fixed é o valor fixo da dividida por tamanho (opcional).
// opts: { requireFixed } — quando true (modo 'fixed'), cada tamanho com preço exige seu fixo.
export function validateProductPrices(isPizza,available,fields,opts){
  const errors={};const prices=[];
  const requireFixed = !!(opts && opts.requireFixed);
  if(!isPizza)return {errors,prices};
  const parseMoney=(raw)=>{
    const text=typeof raw==='string'?raw.trim():raw;
    if(text===''||text==null) return { empty:true, value:null };
    let value=NaN;
    if(typeof text==='number')value=text;
    else if(typeof text==='string'&&/^(?:\d+|\d{1,3}(?:\.\d{3})+)(?:,\d{1,2})?$/.test(text))value=Number(text.replace(/\./g,'').replace(',','.'));
    if(!Number.isFinite(value)||value<=0||value>99999999.99||Math.abs(value*100-Math.round(value*100))>0.00001) return { empty:false, value:null };
    return { empty:false, value };
  };
  for(const f of fields){
    const parsed=parseMoney(f.value);
    if(parsed.empty)continue;
    if(parsed.value==null){errors[f.id]='Informe um preço válido maior que zero, com até duas casas decimais.';continue;}
    const entry={size_id:f.id,price:parsed.value};
    if(f.fixed!==undefined||requireFixed){
      const parsedFixed=parseMoney(f.fixed);
      if(parsedFixed.empty){
        if(requireFixed) errors['fixed-'+f.id]='Informe o valor fixo da dividida para este tamanho.';
      } else if(parsedFixed.value==null){
        errors['fixed-'+f.id]='Informe um valor fixo válido maior que zero, com até duas casas decimais.';
      } else entry.fraction_fixed_price=parsedFixed.value;
    }
    prices.push(entry);
  }
  if(available&&!prices.some(p=>fields.some(f=>f.id===p.size_id&&f.active===true)))errors._sizes='Pizza disponível precisa de pelo menos um tamanho ativo com preço válido.';
  return {errors,prices};
}

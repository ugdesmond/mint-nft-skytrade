use anchor_lang::prelude::*;
use anchor_spl::{
    metadata::{Metadata, MetadataAccount},
    token::Mint,
};
use mpl_bubblegum::{
    cpi::{
        accounts::{  MintToCollectionV1},
         mint_to_collection_v1,
    },
    program::Bubblegum,
    state::metaplex_adapter::{
        Collection, Creator, MetadataArgs, TokenProgramVersion, TokenStandard,
    },
};
use solana_program::pubkey::Pubkey;
use spl_account_compression::{program::SplAccountCompression, Noop};


declare_id!("Ge87He7n627iPhk59xu23wtjsuEE5WbZbKJsmcc5iRRe");

pub const SEED: &str = "AUTH";


#[program]
pub mod mint_nft_skytrade {
    use super::*;

    pub fn mint_nft(context: Context<MintNftToCollection>) -> Result<()> {
        let signer_seeds: &[&[&[u8]]] = &[&[SEED.as_bytes(), &[*context.bumps.get("pda").unwrap()]]];


        // use collection nft metadata as the metadata for the compressed nft
        let metadata_account = &context.accounts.collection_metadata;
        let metadata = MetadataArgs {
            // The name of the asset
            name: metadata_account.data.name.to_string(),
            // The symbol for the asset
            symbol: metadata_account.data.symbol.to_string(),
            // URI pointing to JSON representing the asset
            uri: metadata_account.data.uri.to_string(),
            // Collection
            collection: Some(Collection {
                key: context.accounts.collection_mint.key(),
                verified: false,
            }),
            primary_sale_happened: true,
            is_mutable: true,
            edition_nonce: None,
            token_standard: Some(TokenStandard::NonFungible),
            uses: None,
            token_program_version: TokenProgramVersion::Original,
            // set creator as pda
            creators: vec![Creator {
                address: context.accounts.pda.key(), 
                verified: true,
                share: 100,
            }],
            seller_fee_basis_points: 0,
        };

        let cpi_ctx = CpiContext::new_with_signer(
            context.accounts.bubblegum_program.to_account_info(),
            MintToCollectionV1 {
                tree_authority: context.accounts.tree_authority.to_account_info(),
                leaf_owner: context.accounts.payer.to_account_info(),
                leaf_delegate: context.accounts.payer.to_account_info(),
                merkle_tree: context.accounts.merkle_tree.to_account_info(),
                payer: context.accounts.payer.to_account_info(),
                tree_delegate: context.accounts.pda.to_account_info(), 
                collection_authority: context.accounts.pda.to_account_info(), 
                collection_authority_record_pda: context.accounts.bubblegum_program.to_account_info(),
                collection_mint: context.accounts.collection_mint.to_account_info(), 
                collection_metadata: context.accounts.collection_metadata.to_account_info(),
                edition_account: context.accounts.edition_account.to_account_info(), 
                bubblegum_signer: context.accounts.bubblegum_signer.to_account_info(),
                log_wrapper: context.accounts.log_wrapper.to_account_info(),
                compression_program: context.accounts.compression_program.to_account_info(),
                token_metadata_program: context.accounts.token_metadata_program.to_account_info(),
                system_program: context.accounts.system_program.to_account_info(),
            },
            signer_seeds,
        );

          mint_to_collection_v1(cpi_ctx, metadata)?;

        Ok(())
    }


}

#[derive(Accounts)]
pub struct MintNftToCollection<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    /// CHECK:
    #[account(
        seeds = [SEED.as_bytes()],
        bump,
    )]
    pub pda: UncheckedAccount<'info>,

    /// CHECK:
    #[account(
        mut,
        seeds = [merkle_tree.key().as_ref()],
        bump,
        seeds::program = bubblegum_program.key()
    )]
    pub tree_authority: UncheckedAccount<'info>,

    /// CHECK:
    #[account(mut)]
    pub merkle_tree: UncheckedAccount<'info>,

    /// CHECK:
    #[account(
        seeds = ["collection_cpi".as_bytes()],
        seeds::program = bubblegum_program.key(),
        bump,
    )]
    pub bubblegum_signer: UncheckedAccount<'info>,

    pub log_wrapper: Program<'info, Noop>,
    pub compression_program: Program<'info, SplAccountCompression>,
    pub bubblegum_program: Program<'info, Bubblegum>,
    pub token_metadata_program: Program<'info, Metadata>,
    pub system_program: Program<'info, System>,

    pub collection_mint: Box<Account<'info, Mint>>,
    #[account(mut)]
    pub collection_metadata: Box<Account<'info, MetadataAccount>>,
    /// CHECK:
    pub edition_account: UncheckedAccount<'info>,
}
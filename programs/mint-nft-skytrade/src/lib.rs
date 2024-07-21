use anchor_lang::prelude::*;
use anchor_spl::{
    metadata::{Metadata, MetadataAccount},
    token::Mint,
};
use mpl_bubblegum::{
    cpi::{
        accounts::{ CreateTree, MintToCollectionV1},
        create_tree, mint_to_collection_v1,
    },
    program::Bubblegum,
    state::metaplex_adapter::{
        Collection, Creator, MetadataArgs, TokenProgramVersion, TokenStandard,
    },
};
use solana_program::pubkey::Pubkey;
use spl_account_compression::{program::SplAccountCompression, Noop};
use solana_program::msg;

use solana_program::{
    instruction::{AccountMeta, Instruction},
    system_program, sysvar,
};

declare_id!("EQojAAdyr3cDbGyhrzjN4V2fLAY6ZnJ8Xsxs9QApZLjh");

pub const SEED: &str = "AUTH";


#[program]
pub mod mint_nft_skytrade {
    use super::*;

    pub fn anchor_create_tree(
        ctx: Context<AnchorCreateTree>,
        max_depth: u32,
        max_buffer_size: u32,
    ) -> Result<()> {
        let signer_seeds: &[&[&[u8]]] = &[&[SEED.as_bytes(), &[*ctx.bumps.get("pda").unwrap()]]];
        msg!("=============Creating tree with max_depth: {}, max_buffer_size: {}", max_depth, max_buffer_size);
         // Log the account info for debugging
    msg!("Tree Authority: {}", ctx.accounts.tree_authority.key);
    msg!("Merkle Tree: {}", ctx.accounts.merkle_tree.key);
    msg!("Payer: {}", ctx.accounts.payer.key);
    msg!("Tree Creator: {}", ctx.accounts.tree_authority.key);
    msg!("Log Wrapper: {}", ctx.accounts.log_wrapper.key);
    msg!("Compression Program: {}", ctx.accounts.compression_program.key);
    msg!("System Program: {}", ctx.accounts.system_program.key);


   

        create_tree(
            CpiContext::new_with_signer(
                ctx.accounts.bubblegum_program.to_account_info(),
                CreateTree {
                    tree_authority: ctx.accounts.tree_authority.to_account_info(),
                    merkle_tree: ctx.accounts.merkle_tree.to_account_info(),
                    payer: ctx.accounts.payer.to_account_info(),
                    tree_creator: ctx.accounts.pda.to_account_info(), // set creator as pda
                    log_wrapper: ctx.accounts.log_wrapper.to_account_info(),
                    compression_program: ctx.accounts.compression_program.to_account_info(),
                    system_program: ctx.accounts.system_program.to_account_info(),
                },
                signer_seeds,
            ),
            max_depth,
            max_buffer_size,
            Option::from(false),
        )?;
        Ok(())
    }

//     pub fn mint_nft(ctx: Context<MintNftToCollection>) -> Result<()> {
//         let signer_seeds: &[&[&[u8]]] = &[&[SEED.as_bytes(), &[*ctx.bumps.get("pda").unwrap()]]];

//         let metadata = create_metadata_args(&ctx)?;

//         let cpi_ctx = CpiContext::new_with_signer(
//             ctx.accounts.bubblegum_program.to_account_info(),
//             MintToCollectionV1 {
//                 tree_authority: ctx.accounts.tree_authority.to_account_info(),
//                 leaf_owner: ctx.accounts.payer.to_account_info(),
//                 leaf_delegate: ctx.accounts.payer.to_account_info(),
//                 merkle_tree: ctx.accounts.merkle_tree.to_account_info(),
//                 payer: ctx.accounts.payer.to_account_info(),
//                 tree_delegate: ctx.accounts.pda.to_account_info(),
//                 collection_authority: ctx.accounts.pda.to_account_info(),
//                 collection_authority_record_pda: ctx.accounts.bubblegum_program.to_account_info(),
//                 collection_mint: ctx.accounts.collection_mint.to_account_info(),
//                 collection_metadata: ctx.accounts.collection_metadata.to_account_info(),
//                 edition_account: ctx.accounts.edition_account.to_account_info(),
//                 bubblegum_signer: ctx.accounts.bubblegum_signer.to_account_info(),
//                 log_wrapper: ctx.accounts.log_wrapper.to_account_info(),
//                 compression_program: ctx.accounts.compression_program.to_account_info(),
//                 token_metadata_program: ctx.accounts.token_metadata_program.to_account_info(),
//                 system_program: ctx.accounts.system_program.to_account_info(),
//             },
//             signer_seeds,
//         );

//         mint_to_collection_v1(cpi_ctx, metadata)?;

//         Ok(())
//     }

//     fn create_metadata_args(ctx: &Context<MintNftToCollection>) -> Result<MetadataArgs> {
//         let metadata_account = &ctx.accounts.collection_metadata;
//         Ok(MetadataArgs {
//             name: metadata_account.data.name.clone(),
//             symbol: metadata_account.data.symbol.clone(),
//             uri: metadata_account.data.uri.clone(),
//             collection: Some(Collection {
//                 key: ctx.accounts.collection_mint.key(),
//                 verified: false,
//             }),
//             primary_sale_happened: true,
//             is_mutable: true,
//             edition_nonce: None,
//             token_standard: Some(TokenStandard::NonFungible),
//             uses: None,
//             token_program_version: TokenProgramVersion::Original,
//             creators: vec![Creator {
//                 address: ctx.accounts.pda.key(),
//                 verified: true,
//                 share: 100,
//             }],
//             seller_fee_basis_points: 0,
//         })
//     }
 }

#[derive(Accounts)]
pub struct AnchorCreateTree<'info> {
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
    pub log_wrapper: Program<'info, Noop>,
    pub system_program: Program<'info, System>,
    pub bubblegum_program: Program<'info, Bubblegum>,
    pub compression_program: Program<'info, SplAccountCompression>,
}

// #[derive(Accounts)]
// pub struct MintNftToCollection<'info> {
//     #[account(mut)]
//     pub payer: Signer<'info>,

//     /// CHECK:
//     #[account(
//         seeds = [SEED.as_bytes()],
//         bump,
//     )]
//     pub pda: UncheckedAccount<'info>,

//     /// CHECK:
//     #[account(
//         mut,
//         seeds = [merkle_tree.key().as_ref()],
//         bump,
//         seeds::program = bubblegum_program.key()
//     )]
//     pub tree_authority: UncheckedAccount<'info>,

//     /// CHECK:
//     #[account(mut)]
//     pub merkle_tree: UncheckedAccount<'info>,

//     /// CHECK:
//     #[account(
//         seeds = ["collection_cpi".as_bytes()],
//         seeds::program = bubblegum_program.key(),
//         bump,
//     )]
//     pub bubblegum_signer: UncheckedAccount<'info>,

//     pub log_wrapper: Program<'info, Noop>,
//     pub compression_program: Program<'info, SplAccountCompression>,
//     pub bubblegum_program: Program<'info, Bubblegum>,
//     pub token_metadata_program: Program<'info, Metadata>,
//     pub system_program: Program<'info, System>,

//     pub collection_mint: Box<Account<'info, Mint>>,
//     #[account(mut)]
//     pub collection_metadata: Box<Account<'info, MetadataAccount>>,
//     /// CHECK:
//     pub edition_account: UncheckedAccount<'info>,
// }